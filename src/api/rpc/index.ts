import { ApiPromise } from '@polkadot/api';
import { AggregateStatementPathResult } from '../../types.js';
import { ProofOptions } from '../../config/index.js';
import { formatVk } from '../format/index.js';

export async function getAggregateStatementPath(
  api: ApiPromise,
  at: string,
  domainId: number,
  aggregationId: number,
  statement: string,
): Promise<AggregateStatementPathResult> {
  if (typeof at !== 'string' || at.trim() === '') {
    throw new Error('Invalid input: "at" must be a non-empty string.');
  }

  if (typeof statement !== 'string' || statement.trim() === '') {
    throw new Error('Invalid input: "statement" must be a non-empty string.');
  }

  if (typeof domainId !== 'number' || domainId < 0) {
    throw new Error(
      'Invalid input: "domainId" must be a number greater than or equal to 0.',
    );
  }

  if (typeof aggregationId !== 'number' || aggregationId < 0) {
    throw new Error(
      'Invalid input: "aggregationId" must be a number greater than or equal to 0.',
    );
  }

  // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
  if (!api.rpc.aggregate || !api.rpc.aggregate.statementPath) {
    throw new Error(
      'Custom RPC method aggregate.statementPath is not registered in the API instance.',
    );
  }

  try {
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    const result = await api.rpc.aggregate.statementPath(
      at,
      domainId,
      aggregationId,
      statement,
    );

    const jsonResult = result.toJSON() as Record<string, unknown> | null;

    if (!jsonResult || typeof jsonResult !== 'object') {
      throw new Error('Unexpected result format from RPC call.');
    }

    const { root, proof, number_of_leaves, leaf_index, leaf } = jsonResult;

    if (
      typeof root !== 'string' ||
      !Array.isArray(proof) ||
      typeof leaf !== 'string' ||
      typeof number_of_leaves !== 'number' ||
      typeof leaf_index !== 'number'
    ) {
      throw new Error('Invalid response structure from RPC call.');
    }

    const formattedResult: AggregateStatementPathResult = {
      root,
      proof: proof.map(String),
      numberOfLeaves: number_of_leaves,
      leafIndex: leaf_index,
      leaf,
    };

    return formattedResult;
  } catch (error) {
    throw new Error(
      `Error during RPC call: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getVkHash(
  api: ApiPromise,
  proofOptions: ProofOptions,
  vk: unknown,
): Promise<string> {
  try {
    if (
      typeof vk !== 'string' &&
      (typeof vk !== 'object' || vk === null || Array.isArray(vk))
    ) {
      throw new Error(
        `Invalid VK format: expected a string or non-null object, got ${typeof vk}`,
      );
    }

    const formattedVk = await formatVk(proofOptions, vk);

    // @ts-expect-error: Custom RPC methods are not recognized by TypeScript
    if (!api.rpc.vk_hash || typeof api.rpc.vk_hash !== 'object') {
      throw new Error(
        `RPC method for ${proofOptions.proofType} is not registered.`,
      );
    }

    // @ts-expect-error: Custom RPC methods are not recognized by TypeScript
    const rpcCall = api.rpc.vk_hash[proofOptions.proofType];

    if (typeof rpcCall !== 'function') {
      throw new Error(
        `The node does not expose a vk_hash RPC method for proof type "${proofOptions.proofType}".`,
      );
    }

    const result = await rpcCall(formattedVk);

    if (!result || typeof result.toString !== 'function') {
      throw new Error(
        `No VK hash found for proof type "${proofOptions.proofType}".`,
      );
    }

    const hash = result.toString();

    if (
      typeof hash !== 'string' ||
      !hash.startsWith('0x') ||
      hash.length <= 2
    ) {
      throw new Error(
        `No VK hash found for proof type "${proofOptions.proofType}".`,
      );
    }

    return hash;
  } catch (err) {
    throw new Error(
      `RPC call for ${proofOptions.proofType} failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
