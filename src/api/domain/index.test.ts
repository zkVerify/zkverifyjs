import { addDomainSubmitters, removeDomainSubmitters } from './index';
import { RuntimeVersion, TransactionType } from '../../enums';
import { AccountConnection } from '../connection/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { handleTransaction } from '../../utils/transactions';
import * as helpers from '../../utils/helpers';

jest.mock('../../utils/helpers', () => {
  const actual = jest.requireActual('../../utils/helpers');
  return {
    ...actual,
    getKeyringAccountIfAvailable: jest.fn(),
  };
});

jest.mock('../../utils/transactions', () => ({
  handleTransaction: jest.fn(),
}));

describe('Domain API - Runtime Version Checks', () => {
  beforeEach(() => {
    jest
      .spyOn(helpers, 'getKeyringAccountIfAvailable')
      .mockImplementation(
        jest.requireActual('../../utils/helpers').getKeyringAccountIfAvailable,
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addDomainSubmitters', () => {
    it('should throw error when runtime version is too old', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: 1001000,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        addDomainSubmitters(connection, 1, ['address1']);
      }).toThrow(
        /addDomainSubmitters is only available in runtime version 1003000 or later/,
      );
    });

    it('should throw error when submitters array is empty', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        addDomainSubmitters(connection, 1, []);
      }).toThrow(/addDomainSubmitters submitters must not be empty/);
    });

    it('should throw error when domainId is negative', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        addDomainSubmitters(connection, -1, ['address1']);
      }).toThrow(/addDomainSubmitters domainId must be greater than 0/);
    });

    it('should successfully create extrinsic when runtime version is sufficient', async () => {
      const mockExtrinsic = { mock: 'extrinsic' };
      const connection: AccountConnection = {
        api: {
          tx: {
            aggregate: {
              allowlistProofSubmitters: jest
                .fn()
                .mockReturnValue(mockExtrinsic),
            },
          },
        } as any,
        provider: {} as any,
        accounts: new Map([
          ['mockAddress', { address: 'mockAddress' } as KeyringPair],
        ]),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      (handleTransaction as jest.Mock).mockResolvedValue({ domainId: 1 });

      const { transactionResult } = addDomainSubmitters(connection, 1, [
        'address1',
        'address2',
      ]);

      expect(
        connection.api.tx.aggregate.allowlistProofSubmitters,
      ).toHaveBeenCalledWith(1, ['address1', 'address2']);

      await expect(transactionResult).resolves.toEqual({ domainId: 1 });
    });
  });

  describe('removeDomainSubmitters', () => {
    it('should throw error when runtime version is too old', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: 1001000,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        removeDomainSubmitters(connection, 1, ['address1']);
      }).toThrow(
        /removeDomainSubmitters is only available in runtime version 1003000 or later/,
      );
    });

    it('should throw error when submitters array is empty', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        removeDomainSubmitters(connection, 1, []);
      }).toThrow(/removeDomainSubmitters submitters must not be empty/);
    });

    it('should throw error when domainId is negative', () => {
      const connection: AccountConnection = {
        api: {} as any,
        provider: {} as any,
        accounts: new Map(),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      expect(() => {
        removeDomainSubmitters(connection, -1, ['address1']);
      }).toThrow(/removeDomainSubmitters domainId must be greater than 0/);
    });

    it('should successfully create extrinsic when runtime version is sufficient', async () => {
      const mockExtrinsic = { mock: 'extrinsic' };
      const connection: AccountConnection = {
        api: {
          tx: {
            aggregate: {
              removeProofSubmitters: jest.fn().mockReturnValue(mockExtrinsic),
            },
          },
        } as any,
        provider: {} as any,
        accounts: new Map([
          ['mockAddress', { address: 'mockAddress' } as KeyringPair],
        ]),
        runtimeSpec: {
          specVersion: RuntimeVersion.V1_3_0,
          specName: 'test-runtime',
        },
      };

      (handleTransaction as jest.Mock).mockResolvedValue({ domainId: 1 });

      const { transactionResult } = removeDomainSubmitters(connection, 1, [
        'address1',
        'address2',
      ]);

      expect(
        connection.api.tx.aggregate.removeProofSubmitters,
      ).toHaveBeenCalledWith(1, ['address1', 'address2']);

      await expect(transactionResult).resolves.toEqual({ domainId: 1 });
    });
  });
});
