import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  SignerOptions,
  SubmittableExtrinsic,
  Signer,
} from '@polkadot/api/types';
import { EventEmitter } from 'events';
import { TransactionInfo } from '../../types';
import { waitForNewAttestationEvent } from '../helpers';
import { handleTransactionEvents } from './events';
import { VerifyOptions } from '../../session/types';
import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../enums';
import { handleError } from './errors';
import { TransactionInfoByType } from './types';

/**
 * Safe wrapper for emitting events without crashing.
 */
const safeEmit = (emitter: EventEmitter, event: string, data: unknown) => {
  try {
    emitter.emit(event, data);
  } catch (error) {
    console.debug(`Failed to emit event ${event}:`, error);
  }
};

/**
 * Handles "In Block" transaction updates.
 */
const handleInBlock = async <T extends TransactionType>(
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: TransactionInfoByType[T],
  setAttestationId: (id: number | undefined) => void,
  emitter: EventEmitter,
  transactionType: T,
): Promise<void> => {
  if (transactionInfo.status === TransactionStatus.Error) return;

  transactionInfo.status = TransactionStatus.InBlock;

  const updatedTransactionInfo = handleTransactionEvents(
    api,
    events,
    transactionInfo,
    emitter,
    setAttestationId,
    transactionType,
  );

  Object.assign(transactionInfo, updatedTransactionInfo);
  safeEmit(emitter, ZkVerifyEvents.IncludedInBlock, transactionInfo);
};

/**
 * Handles "Finalized" transaction updates.
 */
const handleFinalized = async <T extends TransactionType>(
  api: ApiPromise,
  transactionInfo: TransactionInfoByType[T],
  dispatchError: unknown,
  emitter: EventEmitter,
  transactionType: T,
): Promise<void> => {
  if (transactionInfo.status === TransactionStatus.Error) return;

  if (dispatchError) {
    handleError(emitter, api, transactionInfo, dispatchError);
    return;
  }

  transactionInfo.status = TransactionStatus.Finalized;

  switch (transactionType) {
    case TransactionType.Verify: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.Verify];
      if (info.attestationId) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but no attestation ID found.',
        });
      }
      break;
    }

    case TransactionType.VKRegistration: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.VKRegistration];
      if (info.statementHash) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but no statement hash found.',
        });
      }
      break;
    }

    case TransactionType.DomainRegistration: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.DomainRegistration];
      if (info.domainId !== undefined) {
        safeEmit(emitter, ZkVerifyEvents.NewDomain, {
          domainId: info.domainId,
        });
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but no domain ID found.',
        });
      }
      break;
    }

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.DomainHold];
      if (info.domainState !== undefined) {
        safeEmit(emitter, ZkVerifyEvents.DomainStateChanged, {
          domainId: info.domainId,
          domainState: info.domainState,
        });
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but no domain state returned.',
        });
      }
      break;
    }

    default: {
      console.warn('Unknown transaction type finalized:', transactionType);
      break;
    }
  }
};

/**
 * Initializes a transaction object based on its type.
 */
const initializeTransactionInfo = <T extends TransactionType>(
  transactionType: T,
  options: VerifyOptions,
): TransactionInfoByType[T] => {
  const baseInfo: TransactionInfo = {
    blockHash: '',
    status: TransactionStatus.Pending,
    txHash: undefined,
  };

  switch (transactionType) {
    case TransactionType.Verify:
      return {
        ...baseInfo,
        proofType: options.proofOptions?.proofType,
        attestationId: undefined,
        leafDigest: null,
        attestationConfirmed: false,
      } as TransactionInfoByType[T];

    case TransactionType.VKRegistration:
      return {
        ...baseInfo,
        proofType: options.proofOptions?.proofType,
        statementHash: undefined,
      } as TransactionInfoByType[T];

    case TransactionType.DomainRegistration:
      return {
        ...baseInfo,
        domainId: undefined,
      } as TransactionInfoByType[T];

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister:
      return {
        ...baseInfo,
        domainId: undefined,
        domainState: '',
      } as TransactionInfoByType[T];

    default:
      throw new Error(`Unsupported transaction type: ${transactionType}`);
  }
};

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
): Promise<TransactionInfoByType[T]> => {
  const transactionInfo = initializeTransactionInfo(transactionType, options);

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

        if (
          transactionType === TransactionType.Verify &&
          options.waitForNewAttestationEvent
        ) {
          const verifyInfo =
            transactionInfo as TransactionInfoByType[TransactionType.Verify];

          if (verifyInfo.attestationId) {
            try {
              verifyInfo.attestationEvent = await waitForNewAttestationEvent(
                api,
                verifyInfo.attestationId,
                emitter,
              );
              verifyInfo.attestationConfirmed = true;
            } catch (error) {
              cancelTransaction(error);
            }
          }
        }

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
              () => {},
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
