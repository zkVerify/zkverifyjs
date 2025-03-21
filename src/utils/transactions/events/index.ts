import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { DispatchInfo } from '@polkadot/types/interfaces';
import { EventEmitter } from 'events';
import { TransactionType } from '../../../enums';
import { getProofPallet } from '../../helpers';
import { TransactionInfoByType } from '../types';
import { VerifyTransactionInfo, VKRegistrationTransactionInfo } from '../../../types';

export const handleTransactionEvents = <T extends TransactionType>(
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: TransactionInfoByType[T],
  emitter: EventEmitter,
  setAggregationId: (id: number | undefined) => void,
  transactionType: T,
): TransactionInfoByType[T] => {
  let statementHash: string | undefined;
  let aggregationId: number | undefined = undefined;
  let statement: string | undefined;
  let receipt: string | undefined;
  let domainId: number | undefined;
  let domainState: string | undefined;

  events.forEach(({ event, phase }, index) => {

    console.log(`Event #${index + 1}: [${event.section}.${event.method}]`);
    console.log(`    Phase: ${phase.toString()}`);
    console.log(`    Data:`, event.data.map((d) => d.toHuman()));

    if (phase.isApplyExtrinsic) {
      transactionInfo.extrinsicIndex = phase.asApplyExtrinsic.toNumber();
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
        getProofPallet(
            (transactionInfo as VerifyTransactionInfo).proofType,
        ) &&
        event.method === 'ProofVerified'
    ) {
      statement = event.data[0].toString();
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
    }

    if (
      (transactionType === TransactionType.DomainHold ||
        transactionType === TransactionType.DomainUnregister) &&
      event.section === 'aggregate' &&
      event.method === 'DomainStateChanged'
    ) {
      const [eventDomainId, state] = event.data;
      domainId = Number(eventDomainId.toString());
      domainState = state.toString();
    }

    if (
      transactionType === TransactionType.DomainRegistration &&
      event.section === 'aggregate' &&
      event.method === 'NewDomain'
    ) {
      domainId = Number(event.data[0].toString());
    }
  });

  switch (transactionType) {
    case TransactionType.DomainRegistration:
      return {
        ...transactionInfo,
        domainId,
      };

    case TransactionType.DomainHold:
    case TransactionType.DomainUnregister:
      return {
        ...transactionInfo,
        domainId,
        domainState,
      };

    case TransactionType.Verify:
      return {
        ...transactionInfo,
        statement,
        domainId,
        aggregationId,
        aggregationConfirmed: false,
      };

    case TransactionType.VKRegistration:
    default:
      return {
        ...transactionInfo,
        statementHash,
      };
  }
};
