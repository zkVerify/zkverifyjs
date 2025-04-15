import { ApiPromise } from '@polkadot/api';
import { AggregateStatementPathResult } from '../../types';
import { ProofType } from '../../config';

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const humanResult = result.toHuman() as Record<string, any>;

    if (!humanResult || typeof humanResult !== 'object') {
      throw new Error('Unexpected result format from RPC call.');
    }

    const { root, proof, number_of_leaves, leaf_index, leaf } = humanResult;

    if (
      typeof root !== 'string' ||
      !Array.isArray(proof) ||
      typeof leaf !== 'string'
    ) {
      throw new Error('Invalid response structure from RPC call.');
    }

    const formattedResult: AggregateStatementPathResult = {
      root,
      proof: proof.map(String),
      numberOfLeaves: Number(number_of_leaves),
      leafIndex: Number(leaf_index),
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
  proofType: ProofType,
  vk: unknown,
): Promise<string> {
  try {
    if (typeof vk !== 'object' || vk === null) {
      throw new Error(
        `Invalid VK format: expected an object, got ${typeof vk}`,
      );
    }

    // @ts-expect-error: Custom RPC methods are not recognized by TypeScript
    if (!api.rpc.vk_hash || typeof api.rpc.vk_hash !== 'object') {
      throw new Error(`RPC method for ${proofType} is not registered.`);
    }

    // @ts-expect-error: Custom RPC methods are not recognized by TypeScript
    const rpcCall = api.rpc.vk_hash[proofType];

    if (typeof rpcCall !== 'function') {
      throw new Error(`RPC method for ${proofType} is not registered.`);
    }

    const result = await rpcCall(vk);

    if (!result || typeof result.toString !== 'function') {
      throw new Error(`No VK hash found for proof type "${proofType}".`);
    }

    const hash = result.toString();

    if (
      typeof hash !== 'string' ||
      !hash.startsWith('0x') ||
      hash.length <= 2
    ) {
      throw new Error(`No VK hash found for proof type "${proofType}".`);
    }

    return hash;
  } catch (err) {
    throw new Error(
      `RPC call for ${proofType} failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
