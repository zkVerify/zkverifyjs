import {
  FflonkProof,
  FflonkPublicSignals,
  FflonkVerificationKey,
} from '../types.js';
import { requireCanonical, toHex } from '../../groth16/formatter/utils.js';

const BN254_FQ =
  0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const BN254_FR =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

/**
 * Formats the FFLONK verification key.
 *
 * @param {FflonkVerificationKey | string} vkJson - The raw verification key data, either as a JSON string or an object.
 * @returns {FflonkVerificationKey} - The formatted verification key.
 */
export const formatVk = (
  vkJson: FflonkVerificationKey | string,
): FflonkVerificationKey => {
  const vkObject = typeof vkJson === 'string' ? JSON.parse(vkJson) : vkJson;

  return {
    power: vkObject.power,
    k1: vkObject.k1,
    k2: vkObject.k2,
    w: vkObject.w,
    w3: vkObject.w3,
    w4: vkObject.w4,
    w8: vkObject.w8,
    wr: vkObject.wr,
    X_2: vkObject.X_2,
    C0: vkObject.C0,
    get x2() {
      return this.X_2;
    },
    get c0() {
      return this.C0;
    },
  };
};

/**
 * Converts a canonical field element to a 32-byte big-endian hexadecimal string
 * without the `0x` prefix.
 *
 * @param {string} numStr - The number string to convert.
 * @param {bigint} modulus - Field modulus the value must be below.
 * @param {string} what - Label used in the error message.
 * @returns {string} - The 32-byte hexadecimal string.
 * @throws {Error} If the value is negative or not below `modulus`.
 */
export const to32ByteHex = (
  numStr: string,
  modulus: bigint,
  what: string,
): string =>
  toHex(requireCanonical(BigInt(numStr), modulus, what), 32, 'BE').slice(2);

/**
 * Formats the FFLONK proof data.
 *
 * @param {FflonkProof} proof - The raw proof data.
 * @returns {string} - The formatted proof data as a single hexadecimal string.
 */
export const formatProof = (proof: FflonkProof): string => {
  const formatG1 = (g1: string[]): string[] =>
    g1.slice(0, 2).map((v) => to32ByteHex(v, BN254_FQ, 'G1 coordinate'));

  const formattedPolynomials = [
    ...formatG1(proof.polynomials.C1),
    ...formatG1(proof.polynomials.C2),
    ...formatG1(proof.polynomials.W1),
    ...formatG1(proof.polynomials.W2),
  ];

  const formattedEvaluations = [
    proof.evaluations.ql,
    proof.evaluations.qr,
    proof.evaluations.qm,
    proof.evaluations.qo,
    proof.evaluations.qc,
    proof.evaluations.s1,
    proof.evaluations.s2,
    proof.evaluations.s3,
    proof.evaluations.a,
    proof.evaluations.b,
    proof.evaluations.c,
    proof.evaluations.z,
    proof.evaluations.zw,
    proof.evaluations.t1w,
    proof.evaluations.t2w,
    proof.evaluations.inv,
  ].map((v) => to32ByteHex(v, BN254_FR, 'Evaluation'));

  const combined = [...formattedPolynomials, ...formattedEvaluations];
  if (combined.length !== 24) {
    throw new Error(
      `Formatted proof length mismatch. Expected 24 elements, got ${combined.length}`,
    );
  }

  const proofHex = combined.join('');
  if (proofHex.length !== 1536) {
    throw new Error(
      `Formatted proof length mismatch. Expected 1536 hex characters, got ${proofHex.length}`,
    );
  }

  return '0x' + proofHex;
};

/**
 * Formats the first public signal by converting it to a hexadecimal string.
 *
 * @param {FflonkPublicSignals} pubs - The array of public signals to format. Assumes the array contains at least one element.
 * @returns {string} - The formatted hexadecimal string of the first public signal, padded to 64 characters.
 */
export const formatPubs = (pubs: FflonkPublicSignals): string => {
  if (
    !Array.isArray(pubs) ||
    pubs.length === 0 ||
    typeof pubs[0] !== 'string'
  ) {
    throw new Error(
      'Invalid public signals format: Expected a non-empty array of strings.',
    );
  }
  return '0x' + to32ByteHex(pubs[0], BN254_FR, 'Public signal');
};
