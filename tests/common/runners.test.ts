import {
  ProofOptions,
  ProofType,
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

  it('includes legacy fallback Ultrahonk and TEE proof options', async () => {
    const proofOptions: ProofOptions[] = [];

    generateTestPromises(async (options) => {
      proofOptions.push(options);
    });

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
});
