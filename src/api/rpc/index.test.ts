import { getAggregateStatementPath } from './index';
import { ApiPromise } from '@polkadot/api';
import { jest } from '@jest/globals';
import { AggregateStatementPathResult } from '../../types';

describe('getAggregateStatementPath', () => {
  let api: ApiPromise;

  beforeEach(() => {
    const mockStatementPathResult = {
      toHuman: jest.fn().mockReturnValue({
        root: '0x05c3108a7986770ad69be1e0ed049af70d0279b95b07c08bd6b95d58912d7844',
        proof: [],
        number_of_leaves: '1',
        leaf_index: '0',
        leaf: '0xbf6ece54635da4a0ccbe130a251c8edca773236c5aa933aa9a37ffd369300672',
      }),
    };

    api = {
      rpc: {
        aggregate: {
          statementPath: jest
            .fn()
            .mockImplementation(() => Promise.resolve(mockStatementPathResult)),
        },
      },
    } as unknown as ApiPromise;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call statementPath RPC and return a formatted result', async () => {
    const result = await getAggregateStatementPath(
      api,
      '0x123',
      1,
      2,
      'test-statement',
    );
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    expect(api.rpc.aggregate.statementPath).toHaveBeenCalledWith(
      '0x123',
      1,
      2,
      'test-statement',
    );

    const expectedResult: AggregateStatementPathResult = {
      root: '0x05c3108a7986770ad69be1e0ed049af70d0279b95b07c08bd6b95d58912d7844',
      proof: [],
      numberOfLeaves: 1,
      leafIndex: 0,
      leaf: '0xbf6ece54635da4a0ccbe130a251c8edca773236c5aa933aa9a37ffd369300672',
    };

    expect(result).toEqual(expectedResult);
  });

  it('should throw an error if the RPC call fails', async () => {
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    (api.rpc.aggregate.statementPath as jest.Mock).mockImplementation(() => {
      return Promise.reject(new Error('RPC Error'));
    });

    await expect(
      getAggregateStatementPath(api, '0x123', 1, 2, 'test-statement'),
    ).rejects.toThrow('RPC Error');
  });

  it('should throw an error if statementPath is not registered', async () => {
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    delete (api.rpc.aggregate as any).statementPath;

    await expect(
      getAggregateStatementPath(api, '0x123', 1, 2, 'test-statement'),
    ).rejects.toThrow(
      'Custom RPC method aggregate.statementPath is not registered in the API instance.',
    );
  });

  it('should throw an error if "at" is an empty string', async () => {
    await expect(
      getAggregateStatementPath(api, '', 1, 2, 'test-statement'),
    ).rejects.toThrow('Invalid input: "at" must be a non-empty string.');
  });

  it('should throw an error if "statement" is an empty string', async () => {
    await expect(
      getAggregateStatementPath(api, '0x123', 1, 2, ''),
    ).rejects.toThrow('Invalid input: "statement" must be a non-empty string.');
  });

  it('should throw an error if "domainId" is negative', async () => {
    await expect(
      getAggregateStatementPath(api, '0x123', -1, 2, 'test-statement'),
    ).rejects.toThrow(
      'Invalid input: "domainId" must be a number greater than or equal to 0.',
    );
  });

  it('should throw an error if "aggregationId" is negative', async () => {
    await expect(
      getAggregateStatementPath(api, '0x123', 1, -2, 'test-statement'),
    ).rejects.toThrow(
      'Invalid input: "aggregationId" must be a number greater than or equal to 0.',
    );
  });

  it('should throw an error if api.rpc.aggregate is undefined', async () => {
    (api.rpc as any).aggregate = undefined;

    await expect(
      getAggregateStatementPath(api, '0x123', 1, 2, 'test-statement'),
    ).rejects.toThrow(
      'Custom RPC method aggregate.statementPath is not registered in the API instance.',
    );
  });

  it('should throw an error if api.rpc.aggregate is not an object', async () => {
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    (api.rpc.aggregate as any) = null;

    await expect(
      getAggregateStatementPath(api, '0x123', 1, 2, 'test-statement'),
    ).rejects.toThrow(
      'Custom RPC method aggregate.statementPath is not registered in the API instance.',
    );
  });

  it('should call api.rpc.aggregate.statementPath exactly once', async () => {
    await getAggregateStatementPath(api, '0x123', 1, 2, 'test-statement');
    // @ts-expect-error: Custom RPC method 'aggregate.statementPath' is not recognized by TypeScript's type system
    expect(api.rpc.aggregate.statementPath).toHaveBeenCalledTimes(1);
  });
});
