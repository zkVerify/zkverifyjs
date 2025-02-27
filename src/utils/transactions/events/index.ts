import { ApiPromise, SubmittableResult } from '@polkadot/api';
import {
  RegisterDomainTransactionInfo,
  TransactionInfo,
  VKRegistrationTransactionInfo,
  VerifyTransactionInfo,
} from '../../../types';

import { DispatchInfo } from '@polkadot/types/interfaces';
import { EventEmitter } from 'events';
import { TransactionType } from '../../../enums';
import { getProofPallet } from '../../helpers';

export const handleTransactionEvents = (
  api: ApiPromise,
  events: SubmittableResult['events'],
  transactionInfo: TransactionInfo,
  emitter: EventEmitter,
  setAttestationId: (id: number | undefined) => void,
  transactionType: TransactionType,
):
  | VerifyTransactionInfo
  | VKRegistrationTransactionInfo
  | RegisterDomainTransactionInfo => {
  let statementHash: string | undefined;
  let attestationId: number | undefined = undefined;
  let leafDigest: string | null = null;
  let domainId: number | undefined;

  events.forEach(({ event, phase }) => {
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
      event.section === 'poe' &&
      event.method === 'NewElement'
    ) {
      attestationId = Number(event.data[1]);
      leafDigest = event.data[0].toString();
      setAttestationId(attestationId);
    }

    if (
      transactionType === TransactionType.VKRegistration &&
      event.section == getProofPallet(transactionInfo.proofType) &&
      event.method == 'VkRegistered'
    ) {
      statementHash = event.data[0].toString();
    }

    if (
      transactionType === TransactionType.DomainRegistration &&
      event.section === 'aggregate' &&
      event.method === 'DomainRegistered' // Is this correct?
    ) {
      domainId = Number(event.data[0].toString());
      return {
        ...transactionInfo,
        domainId,
      } as RegisterDomainTransactionInfo;
    }
  });

  if (transactionType === TransactionType.Verify) {
    return {
      ...transactionInfo,
      attestationId,
      leafDigest,
      attestationConfirmed: false,
    } as VerifyTransactionInfo;
  }

  return {
    ...transactionInfo,
    statementHash,
  } as VKRegistrationTransactionInfo;
};
