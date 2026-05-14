import { expect, jest } from '@jest/globals';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { accountInfo } from './index.js';

jest.mock('@polkadot/api');

describe('accountInfo', () => {
  let mockApi: jest.Mocked<ApiPromise>;
  let mockKeyringPair: jest.Mocked<KeyringPair>;

  beforeEach(() => {
    mockApi = {
      query: {
        system: {
          account: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<ApiPromise>;

    mockKeyringPair = {
      address: 'mock-address',
    } as jest.Mocked<KeyringPair>;
  });

  it('should return correct account information with typical balances', async () => {
    mockApi.query.system.account.mockResolvedValue({
      data: {
        free: {
          toString: () => '1000',
        },
        reserved: {
          toString: () => '200',
        },
      },
      nonce: {
        toNumber: () => 1,
      },
    } as any);

    const result = await accountInfo(mockApi, mockKeyringPair);

    expect(result).toEqual({
      address: 'mock-address',
      nonce: 1,
      freeBalance: '1000',
      reservedBalance: '200',
    });

    expect(mockApi.query.system.account).toHaveBeenCalledWith('mock-address');
  });

  it('should return correct account information with zero balances', async () => {
    mockApi.query.system.account.mockResolvedValue({
      data: {
        free: {
          toString: () => '0',
        },
        reserved: {
          toString: () => '0',
        },
      },
      nonce: {
        toNumber: () => 0,
      },
    } as any);

    const result = await accountInfo(mockApi, mockKeyringPair);

    expect(result).toEqual({
      address: 'mock-address',
      nonce: 0,
      freeBalance: '0',
      reservedBalance: '0',
    });

    expect(mockApi.query.system.account).toHaveBeenCalledWith('mock-address');
  });

  it('should return correct account information with large balances', async () => {
    mockApi.query.system.account.mockResolvedValue({
      data: {
        free: {
          toString: () => '1000000000000000',
        },
        reserved: {
          toString: () => '500000000000000',
        },
      },
      nonce: {
        toNumber: () => 123456789,
      },
    } as any);

    const result = await accountInfo(mockApi, mockKeyringPair);

    expect(result).toEqual({
      address: 'mock-address',
      nonce: 123456789,
      freeBalance: '1000000000000000',
      reservedBalance: '500000000000000',
    });

    expect(mockApi.query.system.account).toHaveBeenCalledWith('mock-address');
  });

  it('should handle API query failure', async () => {
    mockApi.query.system.account.mockRejectedValue(new Error('API Error'));

    await expect(accountInfo(mockApi, mockKeyringPair)).rejects.toThrow(
      'API Error',
    );
  });
});
