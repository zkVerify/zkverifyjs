import { describe, it, expect } from '@jest/globals';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { assertSubmitProofCall, validateHexString } from './index.js';
import { ProofType } from '../../config/index.js';

const call = (section: string, method: string) =>
  ({
    method: { section, method },
  }) as unknown as SubmittableExtrinsic<'promise'>;

describe('assertSubmitProofCall', () => {
  it('returns the extrinsic when it targets the declared verifier pallet', () => {
    const extrinsic = call('settlementGroth16Pallet', 'submitProof');
    expect(assertSubmitProofCall(extrinsic, ProofType.groth16)).toBe(extrinsic);
    expect(
      assertSubmitProofCall(
        call('settlementRisc0Pallet', 'submitProof'),
        ProofType.risc0,
      ),
    ).toBeDefined();
  });

  it('refuses any other pallet or method', () => {
    expect(() =>
      assertSubmitProofCall(call('balances', 'transferAll'), ProofType.groth16),
    ).toThrow(
      "Refusing to sign balances.transferAll: expected settlementGroth16Pallet.submitProof for proof type 'groth16'.",
    );
    expect(() =>
      assertSubmitProofCall(call('utility', 'batchAll'), ProofType.groth16),
    ).toThrow(/Refusing to sign utility.batchAll/);
    expect(() =>
      assertSubmitProofCall(
        call('settlementGroth16Pallet', 'registerVk'),
        ProofType.groth16,
      ),
    ).toThrow(/Refusing to sign settlementGroth16Pallet.registerVk/);
    expect(() =>
      assertSubmitProofCall(
        call('settlementRisc0Pallet', 'submitProof'),
        ProofType.groth16,
      ),
    ).toThrow(/expected settlementGroth16Pallet.submitProof/);
  });

  it('refuses an object with no decodable call', () => {
    expect(() =>
      assertSubmitProofCall(
        {} as SubmittableExtrinsic<'promise'>,
        ProofType.groth16,
      ),
    ).toThrow(/Refusing to sign/);
  });
});

describe('validateHexString', () => {
  it('accepts 0x-prefixed whole-byte hex, including empty', () => {
    for (const ok of ['0x', '0x00', '0xdeadBEEF', '0x' + 'ab'.repeat(1000)]) {
      expect(validateHexString(ok)).toBe(ok);
    }
  });

  it('rejects missing prefix, odd length, non-hex characters and non-strings', () => {
    for (const bad of ['deadbeef', '0xabc', '0xzz', '0x ab', ' 0xab', '0X12']) {
      expect(() => validateHexString(bad)).toThrow(/Invalid format/);
    }
    expect(() => validateHexString(undefined as unknown as string)).toThrow(
      /Invalid format/,
    );
    expect(() => validateHexString(12 as unknown as string)).toThrow(
      /Invalid format/,
    );
  });
});
