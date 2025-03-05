import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  SignerOptions,
  SubmittableExtrinsic,
  Signer,
} from '@polkadot/api/types';
import { EventEmitter } from 'events';
import {
  DomainHoldTransactionInfo,
  DomainUnregisterTransactionInfo,
  RegisterDomainTransactionInfo,
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
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

const safeEmit = (emitter: EventEmitter, event: string, data: unknown) => {
  try {
    emitter.emit(event, data);
  } catch (error) {
    console.debug(`Failed to emit event ${event}:`, error);
  }
};

const handleInBlock = async (
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: VerifyTransactionInfo | VKRegistrationTransactionInfo,
  setAttestationId: (id: number | undefined) => void,
  emitter: EventEmitter,
  transactionType: TransactionType,
): Promise<void> => {
  if (transactionInfo.status === TransactionStatus.Error) {
    return;
  }

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

const handleFinalized = async (
  api: ApiPromise,
  transactionInfo:
    | VerifyTransactionInfo
    | VKRegistrationTransactionInfo
    | RegisterDomainTransactionInfo
    | DomainHoldTransactionInfo
    | DomainUnregisterTransactionInfo,
  dispatchError: unknown,
  emitter: EventEmitter,
  transactionType: TransactionType,
): Promise<void> => {
  if (transactionInfo.status === TransactionStatus.Error) {
    return;
  }

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
      const domainStateInfo = transactionInfo as
        | DomainHoldTransactionInfo
        | DomainUnregisterTransactionInfo;
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

    default:
      console.warn('Unknown transaction type finalized:', transactionType);
      break;
  }
};

export const handleTransaction = async (
  api: ApiPromise,
  submitExtrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair | string,
  signer: Signer | undefined,
  emitter: EventEmitter,
  options: VerifyOptions,
  transactionType: TransactionType,
): Promise<
  | VerifyTransactionInfo
  | VKRegistrationTransactionInfo
  | RegisterDomainTransactionInfo
  | DomainHoldTransactionInfo
  | DomainUnregisterTransactionInfo
> => {
  const {
    proofOptions: { proofType } = {},
    waitForNewAttestationEvent: shouldWaitForAttestation = false,
    nonce = -1,
  } = options;

  let transactionInfo:
    | VerifyTransactionInfo
    | VKRegistrationTransactionInfo
    | RegisterDomainTransactionInfo
    | DomainHoldTransactionInfo
    | DomainUnregisterTransactionInfo;

  switch (transactionType) {
    case TransactionType.Verify:
      transactionInfo = {
        blockHash: '',
        proofType,
        status: TransactionStatus.Pending,
        txHash: undefined,
        attestationId: undefined,
        leafDigest: null,
        attestationConfirmed: false,
      } as VerifyTransactionInfo;
      break;

    case TransactionType.VKRegistration:
      transactionInfo = {
        blockHash: '',
        proofType,
        status: TransactionStatus.Pending,
        txHash: undefined,
        statementHash: undefined,
      } as VKRegistrationTransactionInfo;
      break;

    case TransactionType.DomainRegistration:
      transactionInfo = {
        blockHash: '',
        status: TransactionStatus.Pending,
        txHash: undefined,
        domainId: -1,
      } as RegisterDomainTransactionInfo;
      break;

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister:
      transactionInfo = {
        blockHash: '',
        status: TransactionStatus.Pending,
        txHash: undefined,
        domainState: '',
      } as DomainHoldTransactionInfo | DomainUnregisterTransactionInfo;
      break;

    default:
      throw new Error(`Unsupported transaction type: ${transactionType}`);
  }

  const setAttestationId = (id: number | undefined) => {
    if (transactionType === TransactionType.Verify) {
      (transactionInfo as VerifyTransactionInfo).attestationId = id;
    }
  };

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
              true,
            );
          }
        } catch (err) {
          reject(err);
          return;
        }
      }
    };

    const finalizeTransaction = async (result: SubmittableResult) => {
      if (transactionInfo.status === TransactionStatus.Error) {
        return;
      }

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
          shouldWaitForAttestation &&
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
            return;
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
      signer ? { signer, nonce } : { nonce },
      async (result: SubmittableResult) => {
        if (transactionInfo.status === TransactionStatus.Error) {
          return;
        }

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
              setAttestationId,
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

function performSignAndSend(
  submitExtrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair | string,
  options: Partial<SignerOptions> | undefined,
  callback: (result: SubmittableResult) => Promise<void>,
) {
  if (typeof account === 'string' && options?.signer) {
    return submitExtrinsic.signAndSend(account, options, callback);
  } else if (typeof account !== 'string') {
    if (options) {
      return submitExtrinsic.signAndSend(account, options, callback);
    } else {
      return submitExtrinsic.signAndSend(account, callback);
    }
  } else {
    throw new Error('Unsupported account or signer type.');
  }
}
