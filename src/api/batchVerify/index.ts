import { handleTransaction } from '../../utils/transactions';
import { AccountConnection, WalletConnection } from '../connection/types';
import { EventEmitter } from 'events';
import { BatchVerifyTransactionInfo } from '../../types';
import { VerifyOptions } from '../../session/types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { format } from '../format';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { VerifyInput } from '../verify/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { getKeyringAccountIfAvailable } from '../../utils/helpers';

export const batchVerify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  emitter: EventEmitter,
  input: VerifyInput[],
): Promise<BatchVerifyTransactionInfo> => {
  const { api } = connection;

  try {
    const selectedAccount = getKeyringAccountIfAvailable(
      connection,
      options.accountAddress,
    );

    const calls: SubmittableExtrinsic<'promise'>[] = input.map((item) => {
      if ('proofData' in item && item.proofData) {
        const { proof, publicSignals, vk } = item.proofData;

        const formatted: FormattedProofData = format(
          options.proofOptions,
          proof,
          publicSignals,
          vk,
          options.registeredVk ?? false,
        );

        return createSubmitProofExtrinsic(
          api,
          options.proofOptions.proofType,
          formatted,
          item.domainId ?? undefined,
        );
      }

      if ('extrinsic' in item && item.extrinsic) {
        return item.extrinsic;
      }

      throw new Error(
        'Invalid input: Either proofData or extrinsic must be provided.',
      );
    });

    if (calls.length === 0) {
      throw new Error('No valid proofs provided for batch verification.');
    }

    const batchTransaction = api.tx.utility.batchAll(calls);

    const result = selectedAccount
      ? await handleTransaction(
          api,
          batchTransaction,
          selectedAccount,
          undefined,
          emitter,
          options,
          TransactionType.BatchVerify,
          input.length,
        )
      : 'injector' in connection
        ? await handleTransaction(
            api,
            batchTransaction,
            connection.accountAddress,
            connection.injector.signer,
            emitter,
            options,
            TransactionType.BatchVerify,
            input.length,
          )
        : (() => {
            throw new Error('Unsupported connection type.');
          })();

    return result as BatchVerifyTransactionInfo;
  } catch (error) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    emitter.removeAllListeners();
    throw error;
  }
};
