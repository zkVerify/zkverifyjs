import { FormattedProofData } from '../../../api/format/types.js';
import { format, formatVk } from '../../../api/format/index.js';
import { ProofOptions } from '../../../config/index.js';
import { ConnectionManager } from '../connection/index.js';
import {
  rejectUnsupportedProofVersions,
  validateProofTypeOptions,
} from '../../validator/index.js';

/**
 * Manages proof formatting operations.
 *
 * Options are validated against the connected runtime, so formatting applies the same
 * version defaults and checks as `verify()`.
 */
export class FormatManager {
  private readonly connectionManager: ConnectionManager;

  /**
   * Creates an instance of FormatManager.
   * @param {ConnectionManager} connectionManager - The connection manager instance.
   */
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

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
    const { runtimeSpec } = this.connectionManager.connectionDetails;
    const validatedOptions = validateProofTypeOptions(
      proofOptions,
      runtimeSpec,
    );
    // Formatted proofs are meant for submission, so reject versions the runtime refuses.
    rejectUnsupportedProofVersions(validatedOptions, runtimeSpec);

    return format(validatedOptions, proof, publicSignals, vk, registeredVk);
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
    return formatVk(
      validateProofTypeOptions(
        proofOptions,
        this.connectionManager.connectionDetails.runtimeSpec,
      ),
      vk,
    );
  }
}
