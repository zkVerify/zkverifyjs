import {
  ProofOptions,
  ProofType,
  RuntimeVersion,
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

  it.each([
    [RuntimeVersion.V1_6_0, UltrahonkVersion.V0_84],
    [RuntimeVersion.V2_0_0, UltrahonkVersion.V0_84],
    [RuntimeVersion.V2_1_0, UltrahonkVersion.V0_84],
  ])(
    'maps version-less Ultrahonk options on runtime %s to %s fixture names',
    (specVersion, fixtureVersion) => {
      expect(
        getProofFilenameComponents(
          {
            proofType: ProofType.ultrahonk,
            config: { variant: UltrahonkVariant.ZK },
          },
          { specName: 'zkverify', specVersion },
        ),
      ).toEqual([
        'ultrahonk',
        fixtureVersion.toLowerCase(),
        UltrahonkVariant.ZK.toLowerCase(),
      ]);
    },
  );

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
