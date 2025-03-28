import { TransactionStatus, TransactionType } from '../../../enums';
import { VerifyOptions } from '../../../session/types';
import { TransactionInfoByType } from '../types';
import { TransactionInfo } from '../../../types';

/**
 * Initializes a transaction object based on its type.
 */
export const initializeTransactionInfo = <T extends TransactionType>(
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
        domainId: options.domainId,
        aggregationId: undefined,
        statement: null,
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
    case TransactionType.Aggregate:
      return {
        ...baseInfo,
      } as TransactionInfoByType[T];

    default:
      throw new Error(`Unsupported transaction type: ${transactionType}`);
  }
};
