import { ConnectionManager } from '../connection';
import { MerkleProof } from '../../../types';
import { getProofDetails } from '../../../api/poe';

/**
 * Manages Proof Of Existence (PoE) operations for retrieving verified proof details.
 */
export class PoEManager {
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Retrieves existing verified proof details based on attestation ID and leaf digest.
   *
   * @param {number} attestationId - The attestation ID for which the proof path is to be retrieved.
   * @param {string} leafDigest - The leaf digest to be used in the proof path retrieval.
   * @param {string} [blockHash] - Optional block hash to retrieve the proof at a specific block.
   * @returns {Promise<MerkleProof>} An object containing the proof path details.
   */
  async poe(
    attestationId: number,
    leafDigest: string,
    blockHash?: string,
  ): Promise<MerkleProof> {
    return getProofDetails(
      this.connectionManager.api,
      attestationId,
      leafDigest,
      blockHash,
    );
  }
}
