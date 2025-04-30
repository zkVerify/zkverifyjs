import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  SignerOptions,
  SubmittableExtrinsic,
  Signer,
} from '@polkadot/api/types';
import { EventEmitter } from 'events';
import { VerifyOptions } from '../../session/types';
import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../enums';
import { handleError } from './errors';
import { TransactionInfoByType } from './types';
import { safeEmit } from '../helpers';
import { initializeTransactionInfo } from './transactionInfo';
import { handleFinalized, handleInBlock } from './handlers';

/**
 * Handles transaction execution, signing, and event handling.
 */
export const handleTransaction = async <T extends TransactionType>(
  api: ApiPromise,
  submitExtrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair | string,
  signer: Signer | undefined,
  emitter: EventEmitter,
  options: VerifyOptions,
  transactionType: T,
  batchCount?: number,
): Promise<TransactionInfoByType[T]> => {
  const transactionInfo = initializeTransactionInfo(
    transactionType,
    options,
    batchCount,
  );

  return new Promise((resolve, reject) => {
    const cancelTransaction = (error: unknown) => {
      if (transactionInfo.status !== TransactionStatus.Error) {
        transactionInfo.status = TransactionStatus.Error;

        try {
          const errObj =
            error instanceof Error ? error : new Error(String(error));
          handleError(emitter, api, transactionInfo, errObj, true);
        } catch (err) {
          reject(err);
          return;
        }
      }
      reject(error);
    };

    const finalizeTransaction = async (result: SubmittableResult) => {
      if (transactionInfo.status === TransactionStatus.Error) return;

      try {
        await handleFinalized(
          api,
          transactionInfo,
          result.dispatchError,
          emitter,
          transactionType,
        );

        resolve(transactionInfo);
      } catch (error) {
        cancelTransaction(error);
      }
    };

    performSignAndSend(
      submitExtrinsic,
      account,
      signer ? { signer, nonce: options.nonce } : { nonce: options.nonce },
      async (result) => {
        if (transactionInfo.status === TransactionStatus.Error) return;

        try {
          if (result.status.isBroadcast) {
            safeEmit(emitter, ZkVerifyEvents.Broadcast, {
              txHash: result.txHash.toString(),
            });
          }

          if (result.status.isInBlock) {
            transactionInfo.txHash = result.txHash.toString();
            transactionInfo.blockHash = result.status.asInBlock.toString();
            await handleInBlock(
              api,
              result.events,
              transactionInfo,
              emitter,
              transactionType,
            );
          }

          if (result.status.isFinalized) {
            await finalizeTransaction(result);
          } else if (result.status.isInvalid) {
            throw new Error('Transaction is invalid.');
          }
        } catch (error) {
          cancelTransaction(error);
        }
      },
    ).catch((error) => {
      cancelTransaction(error);
    });
  });
};

/**
 * Handles signing and sending transactions.
 */
export function performSignAndSend(
  submitExtrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair | string,
  options: Partial<SignerOptions> | undefined,
  callback: (result: SubmittableResult) => Promise<void>,
) {
  if (typeof account === 'string' && options?.signer) {
    return submitExtrinsic.signAndSend(account, options, callback);
  } else if (typeof account !== 'string') {
    return options
      ? submitExtrinsic.signAndSend(account, options, callback)
      : submitExtrinsic.signAndSend(account, callback);
  }
  throw new Error('Unsupported account or signer type.');
}
