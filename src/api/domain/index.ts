import { AccountConnection, WalletConnection } from '../connection/types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { getKeyringAccountIfAvailable } from '../../utils/helpers';
import EventEmitter from 'events';
import { RegisterDomainTransactionInfo } from '../../types';
import { VerifyOptions } from '../../session/types';
import { handleTransaction } from '../../utils/transactions';
import { KeyringPair } from '@polkadot/keyring/types';

export const registerDomain = (
  connection: AccountConnection | WalletConnection,
  aggregationSize: number,
  queueSize: number = 16,
  accountAddress?: string,
): { events: EventEmitter; domainIdPromise: Promise<number> } => {
  if (aggregationSize <= 0 || aggregationSize > 128)
    throw new Error(`registerDomain aggregationSize must be between 1 and 128`);
  if (queueSize <= 0 || queueSize > 16)
    throw new Error(`registerDomain queueSize must be between 1 and 16`);

  const { api } = connection;
  const selectedAccount: KeyringPair | undefined = getKeyringAccountIfAvailable(
    connection,
    accountAddress,
  );

  const registerExtrinsic = api.tx.aggregate.registerDomain(
    aggregationSize,
    queueSize,
  );

  const emitter = new EventEmitter();

  const domainIdPromise = new Promise<number>((resolve, reject) => {
    (async () => {
      try {
        const transactionResult = await (async () => {
          if (selectedAccount) {
            return await handleTransaction(
              api,
              registerExtrinsic,
              selectedAccount,
              undefined,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainRegistration,
            );
          } else if ('injector' in connection) {
            const { signer } = connection.injector;
            return await handleTransaction(
              api,
              registerExtrinsic,
              connection.accountAddress,
              signer,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainRegistration,
            );
          } else {
            throw new Error('Unsupported connection type.');
          }
        })();

        const domainId = (transactionResult as RegisterDomainTransactionInfo)
          .domainId;
        if (typeof domainId !== 'number') {
          throw new Error('Domain registration failed: No domain ID returned');
        }

        emitter.removeAllListeners();
        resolve(domainId);
      } catch (error) {
        emitter.emit(ZkVerifyEvents.ErrorEvent, error);
        emitter.removeAllListeners();
        reject(error);
      }
    })();
  });

  return { events: emitter, domainIdPromise };
};

export const holdDomain = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  accountAddress?: string,
): { events: EventEmitter; done: Promise<void> } => {
  if (domainId < 0)
    throw new Error(`holdDomain domainId must be greater than 0`);

  const { api } = connection;
  const selectedAccount: KeyringPair | undefined = getKeyringAccountIfAvailable(
    connection,
    accountAddress,
  );
  const emitter = new EventEmitter();

  const holdExtrinsic = api.tx.aggregate.holdDomain(domainId);

  const done = new Promise<void>((resolve, reject) => {
    (async () => {
      try {
        await (async () => {
          if (selectedAccount) {
            return await handleTransaction(
              api,
              holdExtrinsic,
              selectedAccount,
              undefined,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainHold,
            );
          } else if ('injector' in connection) {
            const { signer } = connection.injector;
            return await handleTransaction(
              api,
              holdExtrinsic,
              connection.accountAddress,
              signer,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainHold,
            );
          } else {
            throw new Error('Unsupported connection type.');
          }
        })();

        emitter.removeAllListeners();
        resolve();
      } catch (error) {
        emitter.emit(ZkVerifyEvents.ErrorEvent, error);
        emitter.removeAllListeners();
        reject(error);
      }
    })();
  });

  return { events: emitter, done };
};

export const unregisterDomain = (
  connection: AccountConnection | WalletConnection,
  domainId: number,
  accountAddress?: string,
): { events: EventEmitter; done: Promise<void> } => {
  if (domainId < 0)
    throw new Error(`unregisterDomain domainId must be greater than 0`);

  const { api } = connection;
  const selectedAccount: KeyringPair | undefined = getKeyringAccountIfAvailable(
    connection,
    accountAddress,
  );
  const emitter = new EventEmitter();

  const unregisterExtrinsic = api.tx.aggregate.unregisterDomain(domainId);

  const done = new Promise<void>((resolve, reject) => {
    (async () => {
      try {
        await (async () => {
          if (selectedAccount) {
            return await handleTransaction(
              api,
              unregisterExtrinsic,
              selectedAccount,
              undefined,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainUnregister,
            );
          } else if ('injector' in connection) {
            const { signer } = connection.injector;
            return await handleTransaction(
              api,
              unregisterExtrinsic,
              connection.accountAddress,
              signer,
              emitter,
              {} as VerifyOptions,
              TransactionType.DomainUnregister,
            );
          } else {
            throw new Error('Unsupported connection type.');
          }
        })();

        emitter.removeAllListeners();
        resolve();
      } catch (error) {
        emitter.emit(ZkVerifyEvents.ErrorEvent, error);
        emitter.removeAllListeners();
        reject(error);
      }
    })();
  });

  return { events: emitter, done };
};
