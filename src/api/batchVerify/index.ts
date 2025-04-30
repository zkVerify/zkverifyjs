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

  const selectedAccount = getKeyringAccountIfAvailable(
    connection,
    options.accountAddress,
  );

  const calls: SubmittableExtrinsic<'promise'>[] = [];
  let formatError: Error | null = null;

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    try {
      if ('proofData' in item && item.proofData) {
        const { proof, publicSignals, vk } = item.proofData;

        const formatted: FormattedProofData = format(
          options.proofOptions,
          proof,
          publicSignals,
          vk,
          options.registeredVk ?? false,
        );

        const extrinsic = createSubmitProofExtrinsic(
          api,
          options.proofOptions.proofType,
          formatted,
          item.domainId ?? undefined,
        );

        calls.push(extrinsic);
      } else if ('extrinsic' in item && item.extrinsic) {
        calls.push(item.extrinsic);
      } else {
        throw new Error('Missing both proofData and extrinsic.');
      }
    } catch (err) {
      formatError = new Error(
        `Failed to format proof at batch index ${i}: ${(err as Error).message}`,
      );
      break;
    }
  }

  if (formatError) {
    return Promise.reject(formatError);
  }

  if (calls.length === 0) {
    const err = new Error('No valid proofs provided for batch verification.');
    emitter.emit(ZkVerifyEvents.ErrorEvent, err);
    emitter.removeAllListeners();
    throw err;
  }

  const batchTransaction = api.tx.utility.batchAll(calls);

  try {
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
