import fs from 'fs';
import path from 'path';
import { ProofOptions, ProofType } from '../../../config/index.js';
import {
  Risc0Version,
  RuntimeVersion,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../../enums.js';
import { ConnectionManager } from '../connection/index.js';
import { FormatManager } from './index.js';

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '../../../../tests/common/data/ultrahonk_v5_0_zk.json',
    ),
    'utf8',
  ),
);

const manager = (specVersion: RuntimeVersion) =>
  new FormatManager({
    connectionDetails: {
      runtimeSpec: { specName: 'zkverify', specVersion },
    },
  } as unknown as ConnectionManager);

const ultrahonk = (config: {
  version?: UltrahonkVersion;
  variant: UltrahonkVariant;
}): ProofOptions => ({ proofType: ProofType.ultrahonk, config });

describe('FormatManager', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const formatWith = (specVersion: RuntimeVersion, options: ProofOptions) =>
    manager(specVersion).format(
      options,
      fixture.proof,
      fixture.publicSignals,
      fixture.vk,
    );

  it('defaults a missing ultrahonk version to V5_0 on runtime version 2.1.0', async () => {
    const result = await formatWith(
      RuntimeVersion.V2_1_0,
      ultrahonk({ variant: UltrahonkVariant.ZK }),
    );

    expect(result.formattedProof).toEqual({
      V5_0: { ZK: fixture.proof },
    });
    expect(result.formattedVk).toEqual({ Vk: { V5_0: fixture.vk } });
  });

  it('defaults a missing ultrahonk version to Legacy on runtime version 2.0.0', async () => {
    const result = await formatWith(
      RuntimeVersion.V2_0_0,
      ultrahonk({ variant: UltrahonkVariant.Plain }),
    );

    expect(result.formattedProof).toEqual({
      Legacy: { Plain: fixture.proof },
    });
  });

  it('rejects deprecated ultrahonk ZK versions on runtime version 2.1.0', async () => {
    await expect(
      formatWith(
        RuntimeVersion.V2_1_0,
        ultrahonk({
          version: UltrahonkVersion.V3_0,
          variant: UltrahonkVariant.ZK,
        }),
      ),
    ).rejects.toThrow(`Use version '${UltrahonkVersion.V5_0}' for ZK proofs`);
  });

  it('rejects V5_0 before runtime version 2.1.0', async () => {
    await expect(
      formatWith(
        RuntimeVersion.V2_0_0,
        ultrahonk({
          version: UltrahonkVersion.V5_0,
          variant: UltrahonkVariant.ZK,
        }),
      ),
    ).rejects.toThrow('only available in runtime version 2.1.0 or later');
  });

  it('rejects risc0 V2_1 on runtime version 2.1.0', async () => {
    await expect(
      manager(RuntimeVersion.V2_1_0).format(
        { proofType: ProofType.risc0, config: { version: Risc0Version.V2_1 } },
        '0x00',
        '0x00',
        '0x' + '00'.repeat(32),
      ),
    ).rejects.toThrow(`Use '${Risc0Version.V2_2}' or later`);
  });

  it('formats VKs of deprecated ZK versions, which remain valid for Plain proofs', async () => {
    await expect(
      manager(RuntimeVersion.V2_1_0).formatVk(
        ultrahonk({
          version: UltrahonkVersion.V3_0,
          variant: UltrahonkVariant.ZK,
        }),
        fixture.vk,
      ),
    ).resolves.toEqual({ V3_0: fixture.vk });
  });

  it('applies the runtime default when formatting a VK', async () => {
    await expect(
      manager(RuntimeVersion.V2_1_0).formatVk(
        ultrahonk({ variant: UltrahonkVariant.Plain }),
        fixture.vk,
      ),
    ).resolves.toEqual({ V5_0: fixture.vk });
  });
});
