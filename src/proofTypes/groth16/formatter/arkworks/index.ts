import {
  ArkworksProofInput,
  Groth16VerificationKey,
  Proof,
  ProofInput,
} from '../../types';
import { ProofOptions } from '../../../../config';
import { isGroth16Config } from '../../../../utils/helpers';

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
  console.log('[Arkworks] formatProof called');
  console.log('[Arkworks] Raw proof input:', JSON.stringify(proof, null, 2));
  console.log('[Arkworks] Proof options:', options);

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
    console.error('[Arkworks] Invalid proof structure. Snippet:', snippet);
    throw new Error(
      `Invalid Arkworks proof format. Expected { curve, proof: { a, b, c } }. Snippet: "${snippet}..."`,
    );
  }

  const ark = proof as ArkworksProofInput;

  console.log('[Arkworks] Parsed Arkworks proof input:', ark);

  const formatted: Proof = {
    curve: ark.curve,
    proof: {
      a: ark.proof.a,
      b: ark.proof.b,
      c: ark.proof.c,
    },
  };

  console.log('[Arkworks] Returning formatted proof:', formatted);
  return formatted;
};

/**
 * Returns VK as-is, trusting Arkworks formatting is already compatible.
 */
export const formatVk = (
  vk: ArkworksVerificationKey,
  options: ProofOptions,
): Groth16VerificationKey => {
  console.log('[Arkworks] formatVk called');
  console.log('[Arkworks] Raw VK input:', JSON.stringify(vk, null, 2));
  console.log('[Arkworks] Proof options:', options);

  if (!isGroth16Config(options)) {
    throw new Error(
      'Expected Groth16 config but received invalid configuration.',
    );
  }

  const result = {
    ...vk,
    curve: vk.curve ?? options.config.curve,
  };

  console.log('[Arkworks] Returning formatted VK:', result);
  return result;
};

/**
 * Arkworks public signals require no transformation.
 */
export const formatPubs = (pubs: string[]): string[] => {
  console.log('[Arkworks] formatPubs called with:', pubs);
  return pubs;
};

export default {
  formatProof,
  formatVk,
  formatPubs,
};
