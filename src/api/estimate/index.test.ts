import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { estimateCost, convertFeeToToken } from './index';
import { AccountConnection } from '../connection/types';

describe('estimateCost', () => {
  let mockApi: jest.Mocked<ApiPromise>;
  let mockExtrinsic: jest.Mocked<SubmittableExtrinsic<'promise'>>;
  let mockKeyringPair: jest.Mocked<KeyringPair>;
  let connection: AccountConnection;

  beforeEach(() => {
    mockApi = {
      registry: {
        chainDecimals: [18],
      },
    } as unknown as jest.Mocked<ApiPromise>;

    mockExtrinsic = {
      paymentInfo: jest.fn().mockResolvedValue({
        partialFee: {
          toString: () => '1000000000000000000',
        },
        weight: {
          toString: () => '2000000000',
        },
      }),
      length: 100,
    } as unknown as jest.Mocked<SubmittableExtrinsic<'promise'>>;

    mockKeyringPair = {
      address: 'test-address',
    } as unknown as jest.Mocked<KeyringPair>;

    connection = {
      api: mockApi,
      provider: {} as jest.Mocked<any>,
      accounts: new Map([
        ['mockAddress', { address: 'mockAddress' } as KeyringPair],
      ]),
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    };
  });

  it('should estimate the cost of an extrinsic successfully', async () => {
    const result = await estimateCost(mockApi, mockExtrinsic, mockKeyringPair);

    expect(result).toEqual({
      partialFee: '1000000000000000000',
      estimatedFeeInTokens: '1.000000000000000000',
      weight: '2000000000',
      length: 100,
    });
    expect(mockExtrinsic.paymentInfo).toHaveBeenCalledWith(mockKeyringPair);
  });
});

describe('convertFeeToToken', () => {
  it('should correctly convert fee from smallest unit to token unit with 18 decimals', () => {
    const result = convertFeeToToken('1000000000000000000', 18);
    expect(result).toBe('1.000000000000000000');
  });

  it('should handle zero fee correctly', () => {
    const result = convertFeeToToken('0', 18);
    expect(result).toBe('0.000000000000000000');
  });
});
