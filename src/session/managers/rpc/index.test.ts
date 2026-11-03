import { ProofType } from '../../../config/index.js';
import {
  RuntimeVersion,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../../enums.js';
import { getVkHash } from '../../../api/rpc/index.js';
import { ConnectionManager } from '../connection/index.js';
import { RpcManager } from './index.js';

jest.mock('../../../api/rpc/index.js', () => ({
  getAggregateStatementPath: jest.fn(),
  getVkHash: jest.fn().mockResolvedValue('0xhash'),
}));

const api = {};
const manager = (specVersion: RuntimeVersion) =>
  new RpcManager({
    connectionDetails: {
      api,
      runtimeSpec: { specName: 'zkverify', specVersion },
    },
  } as unknown as ConnectionManager);

describe('RpcManager.getVkHash', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (getVkHash as jest.Mock).mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('passes runtime-defaulted options to the vk_hash RPC', async () => {
    await manager(RuntimeVersion.V2_1_0).getVkHash(
      {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      },
      '0x01',
    );

    expect(getVkHash).toHaveBeenCalledWith(
      api,
      {
        proofType: ProofType.ultrahonk,
        config: {
          version: UltrahonkVersion.Legacy,
          variant: UltrahonkVariant.Plain,
        },
      },
      '0x01',
    );
  });

  it('rejects V5_0 before runtime version 2.1.0 without calling the RPC', async () => {
    await expect(
      manager(RuntimeVersion.V2_0_0).getVkHash(
        {
          proofType: ProofType.ultrahonk,
          config: {
            version: UltrahonkVersion.V5_0,
            variant: UltrahonkVariant.Plain,
          },
        },
        '0x01',
      ),
    ).rejects.toThrow('only available in runtime version 2.1.0 or later');
    expect(getVkHash).not.toHaveBeenCalled();
  });

  it.each([
    [{ proofType: ProofType.risc0 }],
    [{ proofType: ProofType.ultraplonk }],
    [{ proofType: ProofType.ezkl }],
    [{ proofType: ProofType.sp1 }],
  ])('does not require proof-only options for %o', async (options) => {
    await manager(1002000 as RuntimeVersion).getVkHash(options, '0x01');
    await manager(RuntimeVersion.V2_1_0).getVkHash(options, '0x01');

    expect(getVkHash).toHaveBeenCalledWith(api, options, '0x01');
  });
});
