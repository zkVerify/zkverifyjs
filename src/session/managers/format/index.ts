import { ProofOptions } from '../../types';
import { FormattedProofData } from '../../../api/format/types';
import { format } from '../../../api/format';

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
   * @param version - Optional version of the proving system (e.g., `V1_1`).
   * @param registeredVk - Optional flag indicating if the verification key is registered.
   * @returns {Promise<FormattedProofData>} A promise resolving to the formatted proof data.
   * @throws {Error} - Throws an error if formatting fails.
   */
  async format(
    proofOptions: ProofOptions,
    proof: unknown,
    publicSignals: unknown,
    vk: unknown,
    version?: string,
    registeredVk?: boolean,
  ): Promise<FormattedProofData> {
    return format(
      proofOptions,
      proof,
      publicSignals,
      vk,
      version,
      registeredVk,
    );
  }
}
