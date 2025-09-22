import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { EventEmitter } from 'events';
import {
  ExtendedDispatchError,
  TransactionInfo,
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
} from '../../../types';
import { TransactionStatus, ZkVerifyEvents } from '../../../enums';
import { DispatchError } from '@polkadot/types/interfaces';

export const decodeDispatchError = (
  api: ApiPromise,
  err: DispatchError,
): { code?: string; message: string; section?: string } => {
  if (err.isModule) {
    try {
      const meta = api.registry.findMetaError(err.asModule);
      const docs = (meta.docs?.join(' ') || '').trim();
      return {
        code: `${meta.section}.${meta.name}`,
        message: docs ? docs : `${meta.section}.${meta.name}`,
        section: meta.section,
      };
    } catch {
      const mod = err.asModule;
      return {
        code: `Module(${mod.index.toString()}:${mod.error.toString()})`,
        message: 'Module error',
      };
    }
  }

  if (err.isToken) {
    return {
      code: `Token.${err.asToken.type}`,
      message: `Token.${err.asToken.type}`,
    };
  }

  if (err.isArithmetic) {
    return {
      code: `Arithmetic.${err.asArithmetic.type}`,
      message: `Arithmetic.${err.asArithmetic.type}`,
    };
  }

  if (err.isBadOrigin) {
    return { code: 'BadOrigin', message: 'BadOrigin' };
  }

  if (err.isCannotLookup) {
    return { code: 'CannotLookup', message: 'CannotLookup' };
  }

  if (err.isOther) {
    return { code: 'Other', message: 'Other' };
  }

  const extended = err as unknown as ExtendedDispatchError;

  if (extended.isTransactional) {
    const kind = extended.asTransactional?.type ?? 'Unknown';
    return { code: `Transactional.${kind}`, message: `Transactional.${kind}` };
  }

  if (extended.isUnavailable) {
    return { code: 'Unavailable', message: 'Unavailable' };
  }

  if (extended.isExhausted) {
    return { code: 'Exhausted', message: 'Exhausted' };
  }

  if (extended.isCorruption) {
    return { code: 'Corruption', message: 'Corruption' };
  }

  return { message: err.toString() };
};

export const handleError = <T extends TransactionInfo>(
  emitter: EventEmitter,
  api: ApiPromise,
  transactionInfo: T,
  error: unknown,
  shouldThrow = true,
  status?: SubmittableResult['status'],
): void | never => {
  let decodedError: string;

  const hasProofType = (
    info: TransactionInfo,
  ): info is VerifyTransactionInfo | VKRegistrationTransactionInfo =>
    'proofType' in info;

  if (error instanceof Error) {
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError.module && parsedError.module.index !== undefined) {
        const dispatchError = api.registry.createType(
          'DispatchError',
          parsedError,
        ) as DispatchError;
        decodedError = decodeDispatchError(api, dispatchError).message;
      } else {
        decodedError = error.message;
      }
    } catch {
      decodedError = error.message;
    }
  } else {
    decodedError = decodeDispatchError(api, error as DispatchError).message;
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
      ...(hasProofType(transactionInfo) && {
        proofType: transactionInfo.proofType,
      }),
      error: decodedError,
    });
  }

  if (shouldThrow) throw new Error(decodedError);
};
