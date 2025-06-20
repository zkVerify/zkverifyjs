import { registerVk } from './index';
import { EventEmitter } from 'events';
import { getProofPallet, getProofProcessor } from '../../utils/helpers';
import { handleTransaction } from '../../utils/transactions';
import { AccountConnection } from '../connection/types';
import { VerifyOptions } from '../../session/types';
import {
  CurveType,
  Library,
  TransactionType,
  ZkVerifyEvents,
} from '../../enums';
import { ProofType } from '../../config';
import { KeyringPair } from '@polkadot/keyring/types';
import * as helpers from '../../utils/helpers';

jest.mock('../../utils/helpers', () => {
  const actual = jest.requireActual('../../utils/helpers');
  return {
    ...actual,
    getProofPallet: jest.fn(),
    getProofProcessor: jest.fn(),
    getSelectedAccount: jest.fn(),
  };
});

jest.mock('../../utils/transactions', () => ({
  handleTransaction: jest.fn(),
}));

describe('registerVk', () => {
  let connection: AccountConnection;
  let mockOptions: VerifyOptions;
  let mockVerificationKey: unknown;
  let mockProcessor: { formatVk: jest.Mock };
  let mockPallet: string;
  let mockExtrinsic: { signAndSend: jest.Mock };

  beforeEach(() => {
    jest
      .spyOn(helpers, 'getSelectedAccount')
      .mockImplementation(
        jest.requireActual('../../utils/helpers').getSelectedAccount,
      );

    connection = {
      api: {
        tx: {
          mockPallet: {
            registerVk: jest.fn(),
          },
        },
      },
      accounts: new Map([
        ['mockAddress', { address: 'mockAddress' } as KeyringPair],
      ]),
    } as unknown as AccountConnection;

    mockOptions = {
      proofOptions: {
        proofType: ProofType.groth16,
        config: {
          library: Library.snarkjs,
          curve: CurveType.bls12381,
        },
      },
    } as VerifyOptions;
    mockVerificationKey = 'mockVerificationKey';

    mockProcessor = {
      formatVk: jest.fn().mockReturnValue('formattedVk'),
    };

    mockPallet = 'mockPallet';
    mockExtrinsic = { signAndSend: jest.fn() };

    (getProofProcessor as jest.Mock).mockResolvedValue(mockProcessor);
    (getProofPallet as jest.Mock).mockReturnValue(mockPallet);

    (
      connection.api.tx[mockPallet].registerVk as unknown as jest.Mock
    ).mockReturnValue(mockExtrinsic);
  });

  it('should successfully register verification key and handle transaction', async () => {
    const mockTransactionInfo = { some: 'transactionInfo' };
    (handleTransaction as jest.Mock).mockResolvedValue(mockTransactionInfo);

    const { events, transactionResult } = await registerVk(
      connection,
      mockOptions,
      mockVerificationKey,
    );

    expect(getProofProcessor).toHaveBeenCalledWith(
      mockOptions.proofOptions.proofType,
    );
    expect(getProofPallet).toHaveBeenCalledWith(
      mockOptions.proofOptions.proofType,
    );
    expect(mockProcessor.formatVk).toHaveBeenCalledWith(
      mockVerificationKey,
      mockOptions.proofOptions,
    );
    expect(connection.api.tx[mockPallet].registerVk).toHaveBeenCalledWith(
      'formattedVk',
    );

    expect(handleTransaction).toHaveBeenCalledWith(
      connection.api,
      mockExtrinsic,
      Array.from(connection.accounts.values())[0],
      undefined,
      expect.any(EventEmitter),
      mockOptions,
      TransactionType.VKRegistration,
    );

    await expect(transactionResult).resolves.toEqual(mockTransactionInfo);
  });

  it('should throw an error for unsupported proof type', async () => {
    (getProofProcessor as jest.Mock).mockResolvedValue(null);

    const { transactionResult } = await registerVk(
      connection,
      mockOptions,
      mockVerificationKey,
    );

    await expect(transactionResult).rejects.toThrow(
      `Unsupported proof type: ${mockOptions.proofOptions.proofType}`,
    );
  });

  it('should throw an error for invalid verification key', async () => {
    const result1 = await registerVk(connection, mockOptions, null);
    await expect(result1.transactionResult).rejects.toThrow(
      'verificationKey cannot be null, undefined, or an empty string',
    );

    const result2 = await registerVk(connection, mockOptions, '');
    await expect(result2.transactionResult).rejects.toThrow(
      'verificationKey cannot be null, undefined, or an empty string',
    );
  });

  it('should reject if transaction fails', async () => {
    const mockError = new Error('Transaction failed');
    (handleTransaction as jest.Mock).mockRejectedValue(mockError);

    const { transactionResult } = await registerVk(
      connection,
      mockOptions,
      mockVerificationKey,
    );

    await expect(transactionResult).rejects.toThrow('Transaction failed');
  });

  it('should throw an error if proof pallet is not found', async () => {
    (getProofPallet as jest.Mock).mockReturnValue(null);

    const { transactionResult } = await registerVk(
      connection,
      mockOptions,
      mockVerificationKey,
    );

    await expect(transactionResult).rejects.toThrow(
      `Unsupported proof type: ${mockOptions.proofOptions.proofType}`,
    );
  });
});
