import { ApiPromise } from '@polkadot/api';
import { AggregateStatementPathResult } from '../../types';

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
