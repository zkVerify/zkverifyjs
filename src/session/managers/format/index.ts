import { FormattedProofData } from '../../../api/format/types';
import { format, formatVk } from '../../../api/format';
import { ProofOptions } from '../../../config';

/**
 * Manages proof formatting operations.
 */
export class FormatManager {
  /**
   * Formats proof details for the specified proof type.
   *
   * @param proofOptions - The options for the proof, including type, library, and curve.
   * @param proof - The proof data to format.
   * @param publicSignals - The public signals associated with the proof.
   * @param vk - The verification key to format.
   * @param registeredVk - Optional flag indicating if the verification key is registered.
   * @returns {Promise<FormattedProofData>} A promise resolving to the formatted proof data.
   * @throws {Error} - Throws an error if formatting fails.
   */
  async format(
    proofOptions: ProofOptions,
    proof: unknown,
    publicSignals: unknown,
    vk: unknown,
    registeredVk?: boolean,
  ): Promise<FormattedProofData> {
    return format(proofOptions, proof, publicSignals, vk, registeredVk);
  }

  /**
   * Formats a verification key using the configured proof processor.
   *
   * @param proofOptions - The options for the proof, including type, library, and curve.
   * @param vk - The verification key to format.
   * @returns The formatted verification key.
   * @throws Throws an error if formatting fails.
   */
  async formatVk(proofOptions: ProofOptions, vk: unknown): Promise<unknown> {
    return formatVk(proofOptions, vk);
  }
}
