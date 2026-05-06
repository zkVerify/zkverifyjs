import {
  ProofOptions,
  ProofType,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../src';
import { getProofFilenameComponents } from './utils';

describe('getProofFilenameComponents', () => {
  it('maps legacy Ultrahonk fallback options to V0_84 fixture names', () => {
    const proofOptions: ProofOptions = {
      proofType: ProofType.ultrahonk,
      config: { variant: UltrahonkVariant.Plain },
    };

    expect(getProofFilenameComponents(proofOptions)).toEqual([
      'ultrahonk',
      UltrahonkVersion.V0_84.toLowerCase(),
      UltrahonkVariant.Plain.toLowerCase(),
    ]);
  });

  it('maps legacy TEE fallback options to Intel fixture names', () => {
    const proofOptions: ProofOptions = {
      proofType: ProofType.tee,
    };

    expect(getProofFilenameComponents(proofOptions)).toEqual([
      'tee',
      TeeVariant.Intel.toLowerCase(),
    ]);
  });
});
