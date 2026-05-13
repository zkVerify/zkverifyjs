import { TransactionType } from '../../enums.js';
import {
  AggregateTransactionInfo,
  BatchVerifyTransactionInfo,
  DomainTransactionInfo,
  RegisterDomainTransactionInfo,
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
  TransactionInfo,
} from '../../types.js';

export type TransactionInfoByType = {
  [TransactionType.Verify]: VerifyTransactionInfo;
  [TransactionType.VKRegistration]: VKRegistrationTransactionInfo;
  [TransactionType.DomainRegistration]: RegisterDomainTransactionInfo;
  [TransactionType.DomainHold]: DomainTransactionInfo;
  [TransactionType.DomainUnregister]: DomainTransactionInfo;
  [TransactionType.DomainAddSubmitters]: TransactionInfo;
  [TransactionType.DomainRemoveSubmitters]: DomainTransactionInfo;
  [TransactionType.Aggregate]: AggregateTransactionInfo;
  [TransactionType.BatchVerify]: BatchVerifyTransactionInfo;
};
