import { ProofType } from '../../../config/index.js';
import { UltrahonkVariant, UltrahonkVersion } from '../../../enums.js';
import processor from './index.js';

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

  it('formats pre-version proofs with variant wrapper', () => {
    expect(
      processor.formatProof('0xproof', {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      }),
    ).toEqual({
      Plain: '0xproof',
    });
  });

  it('formats pre-version verification keys without wrapper', () => {
    expect(
      processor.formatVk('0xvk', {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      }),
    ).toEqual('0xvk');
  });

  it('formats legacy proofs without wrapper', () => {
    expect(
      processor.formatProof('0xproof', {
        proofType: ProofType.ultrahonk,
      }),
    ).toEqual('0xproof');
  });

  it('requires variant when version is provided', () => {
    expect(() =>
      processor.formatProof('0xproof', {
        proofType: ProofType.ultrahonk,
        config: { version: UltrahonkVersion.V3_0 },
      }),
    ).toThrow('expected UltrahonkConfig with version and variant');
  });
});
