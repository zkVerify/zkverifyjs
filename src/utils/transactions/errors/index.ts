import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { EventEmitter } from 'events';
import {
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
} from '../../../types';
import { TransactionStatus, ZkVerifyEvents } from '../../../enums';
import { DispatchError } from '@polkadot/types/interfaces';

export const decodeDispatchError = (
  api: ApiPromise,
  dispatchError: DispatchError,
): string => {
  if (dispatchError.isModule) {
    try {
      const decoded = api.registry.findMetaError(dispatchError.asModule);
      const { docs, name, section } = decoded;

      return `${section}.${name}: ${docs.join(' ')}`;
    } catch {
      return `Unknown module error: ${dispatchError.toString()}`;
    }
  } else if (dispatchError.isToken) {
    return `Token error: ${dispatchError.asToken.type}`;
  } else if (dispatchError.isArithmetic) {
    return `Arithmetic error: ${dispatchError.asArithmetic.type}`;
  } else {
    return dispatchError.toString();
  }
};

export const handleError = (
  emitter: EventEmitter,
  api: ApiPromise,
  transactionInfo: VerifyTransactionInfo | VKRegistrationTransactionInfo,
  error: unknown,
  shouldThrow = true,
  status?: SubmittableResult['status'],
): void | never => {
  let decodedError;

  if (error instanceof Error) {
    try {
      const parsedError = JSON.parse(error.message);

      if (parsedError.module && parsedError.module.index !== undefined) {
        const dispatchError = api.registry.createType(
          'DispatchError',
          parsedError,
        );
        decodedError = decodeDispatchError(api, dispatchError as DispatchError);
      } else {
        decodedError = error.message;
      }
    } catch {
      decodedError = error.message;
    }
  } else {
    decodedError = decodeDispatchError(api, error as DispatchError);
  }

  if (
    status &&
    status.isInvalid &&
    transactionInfo.status !== TransactionStatus.Finalized
  ) {
    transactionInfo.status = TransactionStatus.Invalid;
    decodedError = 'Transaction was marked as invalid.';
  } else {
    transactionInfo.status = TransactionStatus.Error;
  }

  if (emitter.listenerCount(ZkVerifyEvents.ErrorEvent) > 0) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, {
      proofType: transactionInfo.proofType,
      error: decodedError,
    });
  }

  if (shouldThrow) {
    throw new Error(decodedError);
  }
};
