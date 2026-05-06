import {
  ProofOptions,
  ProofType,
  TeeVariant,
  UltrahonkVariant,
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
});
