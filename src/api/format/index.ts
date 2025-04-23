import { ProofProcessor } from '../../types';
import { getProofProcessor } from '../../utils/helpers';
import { FormattedProofData } from './types';
import { ProofOptions } from '../../config';

export function format(
  options: ProofOptions,
  proof: unknown,
  publicSignals: unknown,
  vk: unknown,
  registeredVk?: boolean,
): FormattedProofData {
  const processor: ProofProcessor = getProofProcessor(options.proofType);

  if (!processor) {
    throw new Error(`Unsupported proof type: ${options.proofType}`);
  }

  if (proof === null || proof === undefined || proof === '') {
    throw new Error(
      `${options.proofType}: Proof is required and cannot be null, undefined, or an empty string.`,
    );
  }
  if (
    publicSignals === null ||
    publicSignals === undefined ||
    publicSignals === ''
  ) {
    throw new Error(
      `${options.proofType}: Public signals are required and cannot be null, undefined, or an empty string.`,
    );
  }
  if (vk === null || vk === undefined || vk === '') {
    throw new Error(`${options.proofType}: Verification Key must be provided.`);
  }

  let formattedProof, formattedPubs, formattedVk;

  try {
    formattedProof = processor.formatProof(proof, options);
  } catch (error) {
    const proofSnippet =
      typeof proof === 'string'
        ? proof.slice(0, 50)
        : JSON.stringify(proof).slice(0, 50);
    throw new Error(
      `Failed to format ${options.proofType} proof: ${error instanceof Error ? error.message : 'Unknown error'}. Proof snippet: "${proofSnippet}..."`,
    );
  }
  try {
    formattedPubs = processor.formatPubs(publicSignals, options);
  } catch (error) {
    const pubsSnippet = Array.isArray(publicSignals)
      ? JSON.stringify(publicSignals).slice(0, 50)
      : publicSignals?.toString().slice(0, 50);

    throw new Error(
      `Failed to format ${options.proofType} public signals: ${error instanceof Error ? error.message : 'Unknown error'}. Public signals snippet: "${pubsSnippet}..."`,
    );
  }

  try {
    if (registeredVk) {
      formattedVk = { Hash: vk };
    } else {
      formattedVk = { Vk: processor.formatVk(vk, options) };
    }
  } catch (error) {
    const vkSnippet =
      typeof vk === 'string'
        ? vk.slice(0, 50)
        : JSON.stringify(vk).slice(0, 50);

    throw new Error(
      `Failed to format ${options.proofType} verification key: ${error instanceof Error ? error.message : 'Unknown error'}. Verification key snippet: "${vkSnippet}..."`,
    );
  }

  return {
    formattedProof,
    formattedPubs,
    formattedVk,
  };
}
