import {
  ProofOptions,
  ProofType,
  Risc0Version,
  RuntimeVersion,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../src';
import { generateTestPromises } from './runners';
import { disabledProofTypes } from './options';

describe('generateTestPromises', () => {
  it('skips proof types whose verifier pallet is disabled', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(async (options) => {
      proofOptions.push(options);
    });

    const generated = new Set(proofOptions.map((o) => o.proofType));

    expect(disabledProofTypes.size).toBeGreaterThan(0);
    for (const proofType of disabledProofTypes) {
      expect(generated.has(proofType)).toBe(false);
    }
    expect(generated.has(ProofType.groth16)).toBe(true);
  });

  it('includes legacy fallback Ultrahonk and TEE proof options on runtime version 2.0.0', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(
      async (options) => {
        proofOptions.push(options);
      },
      {
        specName: 'zkverify',
        specVersion: RuntimeVersion.V2_0_0,
      },
    );

    expect(proofOptions).toEqual(
      expect.arrayContaining([
        {
          proofType: ProofType.ultrahonk,
          config: { variant: UltrahonkVariant.Plain },
        },
        {
          proofType: ProofType.ultrahonk,
          config: { variant: UltrahonkVariant.ZK },
        },
        {
          proofType: ProofType.tee,
        },
        {
          proofType: ProofType.tee,
          config: { variant: TeeVariant.Intel },
        },
      ]),
    );
  });

  it('excludes legacy-only explicit ultrahonk configs before runtime version 1.6.1', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(
      async (options) => {
        proofOptions.push(options);
      },
      {
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_5_0,
      },
    );

    expect(proofOptions).toEqual(
      expect.arrayContaining([
        {
          proofType: ProofType.ultrahonk,
          config: { variant: UltrahonkVariant.Plain },
        },
        {
          proofType: ProofType.tee,
        },
      ]),
    );
    expect(proofOptions).not.toEqual(
      expect.arrayContaining([
        {
          proofType: ProofType.ultrahonk,
          config: {
            version: UltrahonkVersion.Legacy,
            variant: UltrahonkVariant.Plain,
          },
        },
        {
          proofType: ProofType.tee,
          config: { variant: TeeVariant.Intel },
        },
      ]),
    );
  });

  it('excludes V5_0 ultrahonk configs before runtime version 2.1.0', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(
      async (options) => {
        proofOptions.push(options);
      },
      {
        specName: 'zkverify',
        specVersion: RuntimeVersion.V2_0_0,
      },
    );

    expect(
      proofOptions.some(
        (o) =>
          o.proofType === ProofType.ultrahonk &&
          (o.config as { version?: UltrahonkVersion })?.version ===
            UltrahonkVersion.V5_0,
      ),
    ).toBe(false);
    expect(proofOptions).toEqual(
      expect.arrayContaining([
        {
          proofType: ProofType.risc0,
          config: { version: Risc0Version.V2_1 },
        },
      ]),
    );
  });

  it('only generates ZK ultrahonk configs for V5_0 and drops risc0 V2_1 from runtime version 2.1.0', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(
      async (options) => {
        proofOptions.push(options);
      },
      {
        specName: 'zkverify',
        specVersion: RuntimeVersion.V2_1_0,
      },
    );

    const ultrahonk = proofOptions
      .filter((o) => o.proofType === ProofType.ultrahonk)
      .map((o) => o.config);

    expect(ultrahonk).toEqual(
      expect.arrayContaining([
        { variant: UltrahonkVariant.Plain },
        { version: UltrahonkVersion.V5_0, variant: UltrahonkVariant.Plain },
        { version: UltrahonkVersion.V5_0, variant: UltrahonkVariant.ZK },
        { version: UltrahonkVersion.V3_0, variant: UltrahonkVariant.Plain },
      ]),
    );
    expect(
      ultrahonk.filter(
        (c) =>
          (c as { variant?: UltrahonkVariant })?.variant ===
          UltrahonkVariant.ZK,
      ),
    ).toEqual([
      { version: UltrahonkVersion.V5_0, variant: UltrahonkVariant.ZK },
    ]);
    expect(
      proofOptions.filter((o) => o.proofType === ProofType.risc0),
    ).not.toContainEqual({
      proofType: ProofType.risc0,
      config: { version: Risc0Version.V2_1 },
    });
  });
});
