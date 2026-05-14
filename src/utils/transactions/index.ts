import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  SignerOptions,
  SubmittableExtrinsic,
  Signer,
} from '@polkadot/api/types';
import { EventEmitter } from 'events';
import { VerifyOptions } from '../../session/types.js';
import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../enums.js';
import { handleError } from './errors/index.js';
import { TransactionInfoByType } from './types.js';
import { safeEmit } from '../helpers/index.js';
import { initializeTransactionInfo } from './transactionInfo/index.js';
import { handleFinalized, handleInBlock } from './handlers/index.js';

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

  let resolveTx!: (value: TransactionInfoByType[T]) => void;
  let rejectTx!: (reason: unknown) => void;
  const txPromise = new Promise<TransactionInfoByType[T]>((res, rej) => {
    resolveTx = res;
    rejectTx = rej;
  });

  let unsubscribeFn: (() => void) | undefined;
  let isCompleted = false;

  const cleanupTransaction = () => {
    if (unsubscribeFn) {
      try {
        unsubscribeFn();
      } catch (err) {
        console.debug('Error during transaction cleanup:', err);
      }
      unsubscribeFn = undefined;
    }
  };

  const handleUnsubscribeFn = (fn: unknown) => {
    if (typeof fn !== 'function') return;

    if (isCompleted) {
      try {
        fn();
      } catch (err) {
        console.debug('Error during late transaction cleanup:', err);
      }
      return;
    }

    unsubscribeFn = fn as () => void;
  };

  const cancelTransaction = (error: unknown) => {
    isCompleted = true;
    cleanupTransaction();

    if (transactionInfo.status !== TransactionStatus.Error) {
      transactionInfo.status = TransactionStatus.Error;

      try {
        const errObj =
          error instanceof Error ? error : new Error(String(error));
        handleError(emitter, api, transactionInfo, errObj, true);
      } catch (err) {
        rejectTx(err);
        return;
      }
    }
    rejectTx(error);
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

      isCompleted = true;
      cleanupTransaction();

      resolveTx(transactionInfo);
    } catch (error) {
      cancelTransaction(error);
    }
  };

  try {
    const unsubscribeResult = performSignAndSend(
      submitExtrinsic,
      account,
      signer ? { signer, nonce: options.nonce } : { nonce: options.nonce },
      async (result) => {
        try {
          if (transactionInfo.status === TransactionStatus.Error) return;

          if (result.status.isBroadcast) {
            const txHash = result.txHash.toString();
            transactionInfo.txHash = txHash;
            safeEmit(emitter, ZkVerifyEvents.Broadcast, {
              txHash,
            });
          }

          if (result.status.isInBlock) {
            if (!transactionInfo.txHash) {
              transactionInfo.txHash = result.txHash.toString();
            }
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
          try {
            cancelTransaction(error);
          } catch (cancelError) {
            console.debug(
              'Error during transaction cancellation:',
              cancelError,
            );
          }
        }
      },
    );

    if (typeof unsubscribeResult === 'function') {
      handleUnsubscribeFn(unsubscribeResult);
    } else if (
      unsubscribeResult &&
      typeof unsubscribeResult.then === 'function'
    ) {
      void (async () => {
        try {
          handleUnsubscribeFn(await unsubscribeResult);
        } catch (error) {
          if (!isCompleted) {
            cancelTransaction(error);
          }
        }
      })();
    }
  } catch (error) {
    cancelTransaction(error);
  }

  return txPromise;
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
