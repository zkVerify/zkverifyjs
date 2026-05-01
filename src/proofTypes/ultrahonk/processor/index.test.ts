import { ProofType } from '../../../config';
import { UltrahonkVariant, UltrahonkVersion } from '../../../enums';
import processor from './index';

describe('UltraHonkProcessor', () => {
  const options = {
    proofType: ProofType.ultrahonk,
    config: {
      version: UltrahonkVersion.V3_0,
      variant: UltrahonkVariant.ZK,
    },
  };

  it('formats proofs with version and variant wrappers', () => {
    expect(processor.formatProof('0xproof', options)).toEqual({
      V3_0: {
        ZK: '0xproof',
      },
    });
  });

  it('formats verification keys with version wrapper', () => {
    expect(processor.formatVk('0xvk', options)).toEqual({
      V3_0: '0xvk',
    });
  });

  it('requires both version and variant options', () => {
    expect(() =>
      processor.formatProof('0xproof', {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain } as never,
      }),
    ).toThrow('expected UltrahonkConfig with version and variant');
  });
});
