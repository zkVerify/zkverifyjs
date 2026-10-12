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
});
