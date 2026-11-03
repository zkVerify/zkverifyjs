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
    expect(processor.formatProof('0x0f', options)).toEqual({
      V3_0: {
        ZK: '0x0f',
      },
    });
  });

  it('formats verification keys with version wrapper', () => {
    expect(processor.formatVk('0x1a', options)).toEqual({
      V3_0: '0x1a',
    });
  });

  it('formats pre-version proofs with variant wrapper', () => {
    expect(
      processor.formatProof('0x0f', {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      }),
    ).toEqual({
      Plain: '0x0f',
    });
  });

  it('formats pre-version verification keys without wrapper', () => {
    expect(
      processor.formatVk('0x1a', {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      }),
    ).toEqual('0x1a');
  });

  it('formats legacy proofs without wrapper', () => {
    expect(
      processor.formatProof('0x0f', {
        proofType: ProofType.ultrahonk,
      }),
    ).toEqual('0x0f');
  });

  it('requires variant when version is provided', () => {
    expect(() =>
      processor.formatProof('0x0f', {
        proofType: ProofType.ultrahonk,
        config: { version: UltrahonkVersion.V3_0 },
      }),
    ).toThrow('expected UltrahonkConfig with version and variant');
  });

  describe('formatPubs', () => {
    const pub = (hex: string) => '0x' + hex.padStart(64, '0');

    it('accepts canonical 32-byte public inputs', () => {
      expect(processor.formatPubs([pub('01'), pub('02')])).toEqual([
        pub('01'),
        pub('02'),
      ]);
    });

    it('accepts the largest canonical public input', () => {
      const max =
        '0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000';
      expect(processor.formatPubs([max])).toEqual([max]);
    });

    it('rejects public inputs equal to the BN254 Fr modulus', () => {
      expect(() =>
        processor.formatPubs([
          '0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001',
        ]),
      ).toThrow('not a canonical field element');
    });

    it('rejects public inputs that are not 32 bytes', () => {
      expect(() => processor.formatPubs(['0x01'])).toThrow('exactly 32 bytes');
    });

    it('rejects non-hex public inputs', () => {
      expect(() => processor.formatPubs(['1'])).toThrow('Invalid format');
    });
  });
});
