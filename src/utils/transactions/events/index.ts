import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { DispatchInfo } from '@polkadot/types/interfaces';
import { EventEmitter } from 'events';
import { TransactionType, ZkVerifyEvents } from '../../../enums';
import { getProofPallet, safeEmit } from '../../helpers';
import { TransactionInfoByType } from '../types';
import {
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
} from '../../../types';

export const handleTransactionEvents = <T extends TransactionType>(
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: TransactionInfoByType[T],
  emitter: EventEmitter,
  transactionType: T,
): TransactionInfoByType[T] => {
  let statementHash: string | undefined;
  let aggregationId: number | undefined;
  let statement: string | undefined;
  let domainId: number | undefined;
  let domainState: string | undefined;
  let receipt: string | undefined;

  let myExtrinsicIndex: number | undefined;

  events.forEach(({ event, phase }) => {
    if (phase.isApplyExtrinsic && myExtrinsicIndex === undefined) {
      myExtrinsicIndex = phase.asApplyExtrinsic.toNumber();
      transactionInfo.extrinsicIndex = myExtrinsicIndex;
    }

    if (
      !phase.isApplyExtrinsic ||
      phase.asApplyExtrinsic.toNumber() !== transactionInfo.extrinsicIndex
    ) {
      return;
    }

    if (
      event.section === 'transactionPayment' &&
      event.method === 'TransactionFeePaid'
    ) {
      transactionInfo.feeInfo = {
        payer: event.data[0].toString(),
        actualFee: event.data[1].toString(),
        tip: event.data[2].toString(),
        paysFee: 'Yes',
      };
    }

    if (event.section === 'system' && event.method === 'ExtrinsicSuccess') {
      const dispatchInfo = event.data[0] as DispatchInfo;
      transactionInfo.weightInfo = {
        refTime: dispatchInfo.weight.refTime?.toString(),
        proofSize: dispatchInfo.weight.proofSize?.toString(),
      };
      transactionInfo.txClass = dispatchInfo.class.toString();

      if (transactionInfo.feeInfo) {
        transactionInfo.feeInfo.paysFee = dispatchInfo.paysFee.toString();
      }
    }

    if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
      const [dispatchError] = event.data;
      throw dispatchError;
    }

    if (
      transactionType === TransactionType.Verify &&
      event.section ===
        getProofPallet((transactionInfo as VerifyTransactionInfo).proofType) &&
      event.method === 'ProofVerified'
    ) {
      statement = event.data[0].toString();
      safeEmit(emitter, ZkVerifyEvents.ProofVerified, { statement });
    }

    if (
      transactionType === TransactionType.Verify &&
      event.section === 'aggregate' &&
      event.method === 'NewProof'
    ) {
      const [eventStatement, eventDomainId, eventAggregationId] = event.data;
      statement = eventStatement.toString();
      domainId = Number(eventDomainId.toString());
      aggregationId = Number(eventAggregationId.toString());
      safeEmit(emitter, ZkVerifyEvents.NewProof, {
        statement,
        domainId,
        aggregationId,
      });
    }

    if (
      transactionType === TransactionType.VKRegistration &&
      event.section ===
        getProofPallet(
          (transactionInfo as VKRegistrationTransactionInfo).proofType,
        ) &&
      event.method === 'VkRegistered'
    ) {
      statementHash = event.data[0].toString();
      safeEmit(emitter, ZkVerifyEvents.VkRegistered, { statementHash });
    }

    if (
      (transactionType === TransactionType.DomainHold ||
        transactionType === TransactionType.DomainUnregister ||
        transactionType === TransactionType.DomainAddSubmitters ||
        transactionType === TransactionType.DomainRemoveSubmitters) &&
      event.section === 'aggregate' &&
      event.method === 'DomainStateChanged'
    ) {
      const [eventDomainId, state] = event.data;
      domainId = Number(eventDomainId.toString());
      domainState = state.toString();
      safeEmit(emitter, ZkVerifyEvents.DomainStateChanged, {
        domainId,
        domainState,
      });
    }

    if (
      transactionType === TransactionType.DomainRegistration &&
      event.section === 'aggregate' &&
      event.method === 'NewDomain'
    ) {
      domainId = Number(event.data[0].toString());
      safeEmit(emitter, ZkVerifyEvents.NewDomain, { domainId });
    }

    if (
      transactionType === TransactionType.Aggregate &&
      event.section === 'aggregate' &&
      event.method === 'NewAggregationReceipt'
    ) {
      const [eventDomainId, eventAggregationId, eventReceipt] = event.data;
      domainId = Number(eventDomainId.toString());
      aggregationId = Number(eventAggregationId.toString());
      receipt = eventReceipt.toString();

      safeEmit(emitter, ZkVerifyEvents.NewAggregationReceipt, {
        domainId,
        aggregationId,
        receipt,
      });
    }
  });

  switch (transactionType) {
    case TransactionType.Aggregate:
      return {
        ...transactionInfo,
        domainId,
        aggregationId,
        receipt,
      };

    case TransactionType.DomainRegistration:
      return {
        ...transactionInfo,
        domainId,
      };

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister:
    case TransactionType.DomainRemoveSubmitters:
      return {
        ...transactionInfo,
        domainId,
        domainState,
      };

    case TransactionType.DomainAddSubmitters:
      return {
        ...transactionInfo,
      };

    case TransactionType.Verify:
      return {
        ...transactionInfo,
        statement,
        domainId,
        aggregationId,
      };

    case TransactionType.VKRegistration:
    default:
      return {
        ...transactionInfo,
        statementHash,
      };
  }
};
