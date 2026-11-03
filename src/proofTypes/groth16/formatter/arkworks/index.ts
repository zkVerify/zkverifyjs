import {
  ArkworksProofInput,
  Groth16VerificationKey,
  Proof,
  ProofInput,
} from '../../types.js';
import { ProofOptions } from '../../../../config/index.js';
import {
  isGroth16Config,
  safeSnippet,
  validateHexString,
} from '../../../../utils/helpers/index.js';
import { extractCurve } from '../utils.js';

/**
 * Arkworks VK format already matches Groth16VerificationKey shape.
 */
type ArkworksVerificationKey = Groth16VerificationKey;

/** Maximum number of public inputs accepted by the Groth16 verifier. */
const MAX_NUM_INPUTS = 64;

/** Byte length of a scalar field element (public input) on every supported curve. */
const SCALAR_SIZE = 32;

/** Byte length of an uncompressed G1 point per curve; G2 points are twice as long. */
const G1_SIZE: Record<string, number> = {
  bn254: 64,
  Bls12_381: 96,
};

/**
 * Asserts that `value` is hex encoding exactly `size` bytes. The runtime rejects VK points
 * and public inputs that are not exactly the uncompressed size for the curve.
 */
const requireExactBytes = (value: string, size: number, what: string) => {
  try {
    validateHexString(value);
  } catch {
    throw new Error(`${what} must be 0x-prefixed hex.`);
  }
  if (value.length !== 2 + size * 2) {
    throw new Error(
      `${what} must be exactly ${size} bytes, got ${(value.length - 2) / 2}.`,
    );
  }
};

/**
 * Returns proof as-is, just extracts fields.
 */
export const formatProof = (
  proof: ProofInput,
  options: ProofOptions,
): Proof => {
  if (!isGroth16Config(options)) {
    throw new Error(
      'Expected Groth16 config but received invalid configuration.',
    );
  }

  if (
    !proof ||
    typeof proof !== 'object' ||
    !('proof' in proof) ||
    !proof.proof ||
    typeof proof.proof.a !== 'string' ||
    typeof proof.proof.b !== 'string' ||
    typeof proof.proof.c !== 'string' ||
    typeof proof.curve !== 'string'
  ) {
    throw new Error(
      `Invalid Arkworks proof format. Expected { curve, proof: { a, b, c } }. Snippet: "${safeSnippet(proof, 80)}..."`,
    );
  }

  const ark = proof as ArkworksProofInput;
  const curve = extractCurve(options.config.curve);

  return {
    curve,
    proof: {
      a: ark.proof.a,
      b: ark.proof.b,
      c: ark.proof.c,
    },
  };
};

/**
 * Returns VK as-is, trusting Arkworks formatting is already compatible.
 */
export const formatVk = (
  vk: ArkworksVerificationKey,
  options: ProofOptions,
): Groth16VerificationKey => {
  if (!isGroth16Config(options)) {
    throw new Error(
      'Expected Groth16 config but received invalid configuration.',
    );
  }

  const curve = extractCurve(options.config.curve);
  const g1 = G1_SIZE[curve];
  const g2 = 2 * g1;

  if (!Array.isArray(vk?.gamma_abc_g1)) {
    throw new Error('Arkworks VK gamma_abc_g1 must be an array.');
  }
  if (vk.gamma_abc_g1.length > MAX_NUM_INPUTS + 1) {
    throw new Error(
      `Arkworks VK gamma_abc_g1 must have at most ${MAX_NUM_INPUTS + 1} points, got ${vk.gamma_abc_g1.length}.`,
    );
  }
  requireExactBytes(vk.alpha_g1, g1, 'Arkworks VK alpha_g1');
  requireExactBytes(vk.beta_g2, g2, 'Arkworks VK beta_g2');
  requireExactBytes(vk.gamma_g2, g2, 'Arkworks VK gamma_g2');
  requireExactBytes(vk.delta_g2, g2, 'Arkworks VK delta_g2');
  vk.gamma_abc_g1.forEach((point, i) =>
    requireExactBytes(point, g1, `Arkworks VK gamma_abc_g1[${i}]`),
  );

  const result = {
    ...vk,
    curve,
  };

  return result;
};

/**
 * Arkworks public signals require no transformation, only a length check.
 */
export const formatPubs = (pubs: string[]): string[] => {
  if (pubs.length > MAX_NUM_INPUTS) {
    throw new Error(
      `Arkworks public inputs must number at most ${MAX_NUM_INPUTS}, got ${pubs.length}.`,
    );
  }
  pubs.forEach((pub, i) =>
    requireExactBytes(pub, SCALAR_SIZE, `Arkworks public input [${i}]`),
  );
  return pubs;
};

export default {
  formatProof,
  formatVk,
  formatPubs,
};
