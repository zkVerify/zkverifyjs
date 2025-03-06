import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  SignerOptions,
  SubmittableExtrinsic,
  Signer,
} from '@polkadot/api/types';
import { EventEmitter } from 'events';
import {
  DomainTransactionInfo,
  RegisterDomainTransactionInfo,
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
  TransactionInfo,
} from '../../types';
import { waitForNewAttestationEvent } from '../helpers';
import { handleTransactionEvents } from './events';
import { VerifyOptions } from '../../session/types';
import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../enums';
import { handleError } from './errors';

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
const handleInBlock = async (
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: VerifyTransactionInfo | VKRegistrationTransactionInfo,
  setAttestationId: (id: number | undefined) => void,
  emitter: EventEmitter,
  transactionType: TransactionType,
) => {
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
const handleFinalized = async (
  api: ApiPromise,
  transactionInfo: TransactionInfo,
  dispatchError: unknown,
  emitter: EventEmitter,
  transactionType: TransactionType,
) => {
  if (transactionInfo.status === TransactionStatus.Error) return;

  if (dispatchError) {
    handleError(emitter, api, transactionInfo, dispatchError);
    return;
  }

  transactionInfo.status = TransactionStatus.Finalized;

  switch (transactionType) {
    case TransactionType.Verify: {
      const verifyInfo = transactionInfo as VerifyTransactionInfo;
      if (verifyInfo.attestationId) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, verifyInfo);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...verifyInfo,
          error: 'Finalized but no attestation ID found.',
        });
      }
      break;
    }

    case TransactionType.VKRegistration: {
      const vkInfo = transactionInfo as VKRegistrationTransactionInfo;
      if (vkInfo.statementHash) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, vkInfo);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...vkInfo,
          error: 'Finalized but no statement hash found.',
        });
      }
      break;
    }

    case TransactionType.DomainRegistration: {
      const domainInfo = transactionInfo as RegisterDomainTransactionInfo;
      if (domainInfo.domainId !== undefined) {
        safeEmit(emitter, ZkVerifyEvents.NewDomain, {
          domainId: domainInfo.domainId,
        });
        safeEmit(emitter, ZkVerifyEvents.Finalized, domainInfo);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...domainInfo,
          error: 'Finalized but no domain ID found.',
        });
      }
      break;
    }

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister: {
      const domainStateInfo = transactionInfo as DomainTransactionInfo;
      if (domainStateInfo.domainState) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, domainStateInfo);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...domainStateInfo,
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
const initializeTransactionInfo = (
  transactionType: TransactionType,
  options: VerifyOptions,
): TransactionInfo => {
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
      } as VerifyTransactionInfo;

    case TransactionType.VKRegistration:
      return {
        ...baseInfo,
        proofType: options.proofOptions?.proofType,
        statementHash: undefined,
      } as VKRegistrationTransactionInfo;

    case TransactionType.DomainRegistration:
      return { ...baseInfo, domainId: -1 } as RegisterDomainTransactionInfo;

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister:
      return { ...baseInfo, domainState: '' } as DomainTransactionInfo;

    default:
      throw new Error(`Unsupported transaction type: ${transactionType}`);
  }
};

/**
 * Handles transaction execution, signing, and event handling.
 */
export const handleTransaction = async (
  api: ApiPromise,
  submitExtrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair | string,
  signer: Signer | undefined,
  emitter: EventEmitter,
  options: VerifyOptions,
  transactionType: TransactionType,
): Promise<TransactionInfo> => {
  const transactionInfo = initializeTransactionInfo(transactionType, options);

  return new Promise((resolve, reject) => {
    const cancelTransaction = (error: unknown) => {
      if (transactionInfo.status !== TransactionStatus.Error) {
        transactionInfo.status = TransactionStatus.Error;

        try {
          if (error instanceof Error) {
            handleError(emitter, api, transactionInfo, error, true);
          } else {
            handleError(
                emitter,
                api,
                transactionInfo,
                new Error(String(error)),
                true
            );
          }
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
          options.waitForNewAttestationEvent &&
          (transactionInfo as VerifyTransactionInfo).attestationId
        ) {
          try {
            (transactionInfo as VerifyTransactionInfo).attestationEvent =
              await waitForNewAttestationEvent(
                api,
                (transactionInfo as VerifyTransactionInfo).attestationId!,
                emitter,
              );
            (transactionInfo as VerifyTransactionInfo).attestationConfirmed =
              true;
          } catch (error) {
            cancelTransaction(error);
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
      signer ? { signer, nonce: options.nonce ?? -1 } : {},
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
