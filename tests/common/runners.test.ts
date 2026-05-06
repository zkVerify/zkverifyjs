import {
  ProofOptions,
  ProofType,
  RuntimeVersion,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../src';
import { generateTestPromises } from './runners';

describe('generateTestPromises', () => {
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

  it('excludes v1.6-only explicit configs before runtime version 1.6.0', async () => {
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
            version: UltrahonkVersion.V0_84,
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
