import { ConnectionManager } from '../connection';
import { ApiPromise } from '@polkadot/api';
import { getAggregateStatementPath, getVkHash } from '../../../api/rpc';
import { AggregateStatementPathResult } from '../../../types';
import { ProofOptions } from '../../../config';

export class RpcManager {
  private readonly connectionManager: ConnectionManager;

  /**
   * Creates an instance of RpcManager.
   * @param {ConnectionManager} connectionManager - The connection manager instance.
   */
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Retrieves the aggregate statement path from the blockchain via the custom RPC method.
   *
   * @async
   * @function getAggregateStatementPath
   * @param {string} at - The block hash at which to perform the query. Must be a non-empty string.
   * @param {number} domainId - The domain ID for which the aggregation statement path is requested. Must be >= 0.
   * @param {number} aggregationId - The aggregation ID associated with the requested statement path. Must be >= 0.
   * @param {string} statement - The statement hash to query for. Must be a non-empty string.
   * @returns {Promise<AggregateStatementPathResult>} A promise that resolves to the AggregateStatementPathResult.
   * @throws {Error} If any of the inputs are invalid or if the RPC call fails.
   */
  async getAggregateStatementPath(
    at: string,
    domainId: number,
    aggregationId: number,
    statement: string,
  ): Promise<AggregateStatementPathResult> {
    const api: ApiPromise = this.connectionManager.connectionDetails.api;

    return getAggregateStatementPath(
      api,
      at,
      domainId,
      aggregationId,
      statement,
    );
  }

  /**
   * Retrieves the VK hash for the given proof type and verification key.
   *
   * @async
   * @function getVkHash
   * @param {ProofOptions} proofOptions - Proof specific options.
   * @param {string} vk - The verification key string.
   * @returns {Promise<string>} - The resulting VK hash.
   * @throws {Error} If the proof type is unsupported or the RPC call fails.
   */
  async getVkHash(proofOptions: ProofOptions, vk: unknown): Promise<string> {
    const api: ApiPromise = this.connectionManager.connectionDetails.api;
    return getVkHash(api, proofOptions, vk);
  }
}
