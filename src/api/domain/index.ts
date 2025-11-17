import { AccountConnection, WalletConnection } from '../connection/types';
import { RuntimeVersion, TransactionType, ZkVerifyEvents } from '../../enums';
import {
  getKeyringAccountIfAvailable,
  isVersionAtLeast,
  normalizeDeliveryFromOptions,
  requireVersionAtLeast,
} from '../../utils/helpers';
import EventEmitter from 'events';
import {
  AggregateTransactionInfo,
  DomainOptions,
  DomainTransactionInfo,
  RegisterDomainTransactionInfo,
} from '../../types';
import { VerifyOptions } from '../../session/types';
import { handleTransaction } from '../../utils/transactions';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';

export const registerDomain = (
  connection: AccountConnection | WalletConnection,
  aggregationSize: number,
  queueSize: number = 16,
  domainOptions: DomainOptions,
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<RegisterDomainTransactionInfo>;
} => {
  if (aggregationSize <= 0 || aggregationSize > 128)
    throw new Error(`registerDomain aggregationSize must be between 1 and 128`);
  if (queueSize <= 0 || queueSize > 16)
    throw new Error(`registerDomain queueSize must be between 1 and 16`);
  if (domainOptions.aggregateRules === undefined)
    throw new Error(
      `registerDomain deliveryOptions.aggregateRules must be defined`,
    );

  const delivery = normalizeDeliveryFromOptions(domainOptions);
  const { api, runtimeSpec } = connection;

  const isV1_3_0OrLater = isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_3_0);

  if (isV1_3_0OrLater && !domainOptions.proofSecurityRules) {
    throw new Error(
      `registerDomain proofSecurityRules is required for runtime version 1.3.0 or later`,
    );
  }

  const registerExtrinsic = isV1_3_0OrLater
    ? api.tx.aggregate.registerDomain(
        aggregationSize,
        queueSize,
        domainOptions.aggregateRules,
        domainOptions.proofSecurityRules,
        delivery,
        domainOptions.deliveryOwner,
      )
    : api.tx.aggregate.registerDomain(
        aggregationSize,
        queueSize,
        domainOptions.aggregateRules,
        delivery,
        domainOptions.deliveryOwner,
      );

  const emitter = new EventEmitter();

  const transactionResult = performTransaction<RegisterDomainTransactionInfo>(
    connection,
    registerExtrinsic,
    TransactionType.DomainRegistration,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const holdDomain = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<DomainTransactionInfo>;
} => {
  if (domainId < 0)
    throw new Error(`holdDomain domainId must be greater than 0`);

  const holdExtrinsic = connection.api.tx.aggregate.holdDomain(domainId);
  const emitter = new EventEmitter();

  const transactionResult = performTransaction<DomainTransactionInfo>(
    connection,
    holdExtrinsic,
    TransactionType.DomainHold,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const unregisterDomain = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<DomainTransactionInfo>;
} => {
  if (domainId < 0)
    throw new Error(`unregisterDomain domainId must be greater than 0`);

  const unregisterExtrinsic =
    connection.api.tx.aggregate.unregisterDomain(domainId);
  const emitter = new EventEmitter();

  const transactionResult = performTransaction<DomainTransactionInfo>(
    connection,
    unregisterExtrinsic,
    TransactionType.DomainUnregister,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const aggregate = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  aggregationId: number,
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<AggregateTransactionInfo>;
} => {
  const registerExtrinsic = connection.api.tx.aggregate.aggregate(
    domainId,
    aggregationId,
  );
  const emitter = new EventEmitter();

  const transactionResult = performTransaction<AggregateTransactionInfo>(
    connection,
    registerExtrinsic,
    TransactionType.Aggregate,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const addDomainSubmitters = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  submitters: string[],
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<DomainTransactionInfo>;
} => {
  if (domainId < 0)
    throw new Error(`addDomainSubmitters domainId must be greater than 0`);
  if (!submitters || submitters.length === 0)
    throw new Error(`addDomainSubmitters submitters must not be empty`);

  const { api, runtimeSpec } = connection;

  requireVersionAtLeast(
    runtimeSpec,
    RuntimeVersion.V1_3_0,
    'addDomainSubmitters',
  );

  const allowlistExtrinsic = api.tx.aggregate.allowlistProofSubmitters(
    domainId,
    submitters,
  );
  const emitter = new EventEmitter();

  const transactionResult = performTransaction<DomainTransactionInfo>(
    connection,
    allowlistExtrinsic,
    TransactionType.DomainAddSubmitters,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const removeDomainSubmitters = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  submitters: string[],
  signerAccount?: string,
): {
  events: EventEmitter;
  transactionResult: Promise<DomainTransactionInfo>;
} => {
  if (domainId < 0)
    throw new Error(`removeDomainSubmitters domainId must be greater than 0`);
  if (!submitters || submitters.length === 0)
    throw new Error(`removeDomainSubmitters submitters must not be empty`);

  const { api, runtimeSpec } = connection;

  requireVersionAtLeast(
    runtimeSpec,
    RuntimeVersion.V1_3_0,
    'removeDomainSubmitters',
  );

  const removeExtrinsic = api.tx.aggregate.removeProofSubmitters(
    domainId,
    submitters,
  );
  const emitter = new EventEmitter();

  const transactionResult = performTransaction<DomainTransactionInfo>(
    connection,
    removeExtrinsic,
    TransactionType.DomainRemoveSubmitters,
    emitter,
    signerAccount,
  );

  return { events: emitter, transactionResult };
};

export const performTransaction = async <T>(
  connection: AccountConnection | WalletConnection,
  extrinsic: SubmittableExtrinsic<'promise'>,
  transactionType: TransactionType,
  emitter: EventEmitter,
  signerAccount?: string,
): Promise<T> => {
  const { api } = connection;
  const selectedAccount: KeyringPair | undefined = getKeyringAccountIfAvailable(
    connection,
    signerAccount,
  );

  try {
    const result = await (async () => {
      if (selectedAccount) {
        return await handleTransaction(
          api,
          extrinsic,
          selectedAccount,
          undefined,
          emitter,
          {} as VerifyOptions,
          transactionType,
        );
      } else if ('injector' in connection) {
        const { signer } = connection.injector;
        return await handleTransaction(
          api,
          extrinsic,
          connection.accountAddress,
          signer,
          emitter,
          {} as VerifyOptions,
          transactionType,
        );
      } else {
        throw new Error('Unsupported connection type.');
      }
    })();

    emitter.removeAllListeners();
    return result as T;
  } catch (error) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    emitter.removeAllListeners();
    throw error;
  }
};
