import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../../enums';
import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { TransactionInfoByType } from '../types';
import { EventEmitter } from 'events';
import { handleTransactionEvents } from '../events';
import { safeEmit } from '../../helpers';
import { handleError } from '../errors';

/**
 * Handles "In Block" transaction updates.
 */
export const handleInBlock = async <T extends TransactionType>(
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: TransactionInfoByType[T],
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
    transactionType,
  );

  Object.assign(transactionInfo, updatedTransactionInfo);
  safeEmit(emitter, ZkVerifyEvents.IncludedInBlock, transactionInfo);
};

/**
 * Handles "Finalized" transaction updates.
 */
export const handleFinalized = async <T extends TransactionType>(
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
      const hasDomainId = !!info.domainId;
      const hasAggregationId = !!info.aggregationId;

      if (!hasDomainId || hasAggregationId) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but no aggregation ID found.',
        });
      }
      break;
    }

    case TransactionType.BatchVerify: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.BatchVerify];

      if (typeof info.batchCount === 'number' && info.batchCount > 0) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: 'Finalized but batchCount is missing or invalid.',
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

    case TransactionType.Aggregate: {
      const info =
        transactionInfo as TransactionInfoByType[TransactionType.Aggregate];

      if (
        info.domainId !== undefined ||
        info.aggregationId !== undefined ||
        info.receipt !== undefined
      ) {
        safeEmit(emitter, ZkVerifyEvents.Finalized, info);
      } else {
        const missingFields = ['domainId', 'aggregationId', 'receipt']
          .filter((key) => info[key as keyof typeof info] === undefined)
          .join(', ');

        safeEmit(emitter, ZkVerifyEvents.ErrorEvent, {
          ...info,
          error: `Finalized but missing fields: ${missingFields}`,
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
