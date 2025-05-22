import { ProofProcessor } from '../../types';
import { getProofProcessor } from '../../utils/helpers';
import { FormattedProofData } from './types';
import { ProofOptions, ProofType } from '../../config';

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

  if (vk === null || vk === undefined || vk === '') {
    throw new Error(`${options.proofType}: Verification Key must be provided.`);
  }

  if (
    options.proofType !== ProofType.ultraplonk &&
    (publicSignals === null ||
      publicSignals === undefined ||
      publicSignals === '')
  ) {
    throw new Error(
      `${options.proofType}: Public signals are required and cannot be null, undefined, or an empty string.`,
    );
  }

  let formattedProof, formattedPubs, formattedVk;

  try {
    const result = processor.formatProof(proof, options);

    if (
      options.proofType === ProofType.ultraplonk &&
      result &&
      typeof result === 'object' &&
      'proof' in result &&
      'publicSignals' in result
    ) {
      formattedProof = result.proof;
      formattedPubs = result.publicSignals;

      if (!formattedProof) {
        throw new Error('UltraPlonk: proof is missing from formatted result.');
      }

      if (!formattedPubs) {
        throw new Error(
          'UltraPlonk: publicSignals is missing from formatted result.',
        );
      }
    } else {
      formattedProof = result;
    }
  } catch (error) {
    const snippet =
      typeof proof === 'string'
        ? proof.slice(0, 50)
        : JSON.stringify(proof).slice(0, 50);
    throw new Error(
      `Failed to format ${options.proofType} proof: ${error instanceof Error ? error.message : 'Unknown error'}. Proof snippet: "${snippet}..."`,
    );
  }

  if (formattedPubs === undefined) {
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
