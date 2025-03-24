import { TransactionType } from '../../enums';
import {
  DomainTransactionInfo,
  RegisterDomainTransactionInfo,
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
} from '../../types';

export type TransactionInfoByType = {
  [TransactionType.Verify]: VerifyTransactionInfo;
  [TransactionType.VKRegistration]: VKRegistrationTransactionInfo;
  [TransactionType.DomainRegistration]: RegisterDomainTransactionInfo;
  [TransactionType.DomainHold]: DomainTransactionInfo;
  [TransactionType.DomainUnregister]: DomainTransactionInfo;
};
