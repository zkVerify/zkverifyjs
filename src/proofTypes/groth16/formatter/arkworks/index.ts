import {
  ArkworksProofInput,
  Groth16VerificationKey,
  Proof,
  ProofInput,
} from '../../types';
import { ProofOptions } from '../../../../config';
import { isGroth16Config } from '../../../../utils/helpers';
import { extractCurve } from '../utils';

/**
 * Arkworks VK format already matches Groth16VerificationKey shape.
 */
type ArkworksVerificationKey = Groth16VerificationKey;

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
    const snippet = JSON.stringify(proof).slice(0, 80);
    throw new Error(
      `Invalid Arkworks proof format. Expected { curve, proof: { a, b, c } }. Snippet: "${snippet}..."`,
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

  const result = {
    ...vk,
    curve,
  };

  return result;
};

/**
 * Arkworks public signals require no transformation.
 */
export const formatPubs = (pubs: string[]): string[] => {
  return pubs;
};

export default {
  formatProof,
  formatVk,
  formatPubs,
};
