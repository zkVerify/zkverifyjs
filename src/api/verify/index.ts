import { handleTransaction } from '../../utils/transactions';
import { AccountConnection, WalletConnection } from '../connection/types';
import { EventEmitter } from 'events';
import { VerifyTransactionInfo } from '../../types';
import { VerifyOptions } from '../../session/types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { format } from '../format';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { VerifyInput } from './types';
import { ProofData } from '../../types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { KeyringPair } from '@polkadot/keyring/types';

export const verify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  emitter: EventEmitter,
  input: VerifyInput,
): Promise<VerifyTransactionInfo> => {
  try {
    const { api } = connection;
    let transaction: SubmittableExtrinsic<'promise'>;

    let selectedAccount: KeyringPair | undefined;

    if ('accounts' in connection) {
      if (options.accountIdentifier !== undefined) {
        if (typeof options.accountIdentifier === 'number') {
          selectedAccount = Array.from(connection.accounts.values())[
            options.accountIdentifier
          ];
        } else {
          selectedAccount = connection.accounts.get(options.accountIdentifier);
        }
      } else {
        selectedAccount = Array.from(connection.accounts.values())[0];
      }

      if (!selectedAccount) {
        throw new Error(
          `Account ${options.accountIdentifier ?? '0'} not found.`,
        );
      }
    }

    if ('proofData' in input && input.proofData) {
      const { proof, publicSignals, vk, version } =
        input.proofData as ProofData;

      const formattedProofData: FormattedProofData = format(
        options.proofOptions,
        proof,
        publicSignals,
        vk,
        version,
        options.registeredVk,
      );

      transaction = createSubmitProofExtrinsic(
        api,
        options.proofOptions.proofType,
        formattedProofData,
      );
    } else if ('extrinsic' in input && input.extrinsic) {
      transaction = input.extrinsic;
    } else {
      throw new Error(
        'Invalid input: Either proofData or extrinsic must be provided.',
      );
    }

    const result = await (async () => {
      if (selectedAccount) {
        return await handleTransaction(
          api,
          transaction,
          selectedAccount,
          undefined,
          emitter,
          options,
          TransactionType.Verify,
        );
      } else if ('injector' in connection) {
        const { signer } = connection.injector;
        const { accountAddress } = connection;

        return await handleTransaction(
          api,
          transaction,
          accountAddress,
          signer,
          emitter,
          options,
          TransactionType.Verify,
        );
      } else {
        throw new Error('Unsupported connection type.');
      }
    })();

    return result as VerifyTransactionInfo;
  } catch (error) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    emitter.removeAllListeners();
    throw error;
  }
};
