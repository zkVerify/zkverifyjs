import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../connection/types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { checkReadOnly, getSelectedAccount } from '../../utils/helpers';

import EventEmitter from 'events';
import { RegisterDomainTransactionInfo } from '../../types';
import { VerifyOptions } from '../../session/types';
import { handleTransaction } from '../../utils/transactions';

export const registerDomain = async (
  connection: AccountConnection | WalletConnection | EstablishedConnection,
  aggregationSize: number,
  queueSize: number = 16,
  emitter: EventEmitter,
): Promise<number> => {
  if (aggregationSize > 128) throw new Error('aggregationSize must be <= 128');
  if (queueSize > 16) throw new Error('queueSize must be <= 16');

  checkReadOnly(connection);

  const { api } = connection;
  let selectedAccount;

  if ('accounts' in connection) {
    selectedAccount = getSelectedAccount(connection);
  }

  const registerExtrinsic = api.tx.aggregate.registerDomain(
    aggregationSize,
    queueSize,
  );

  try {
    const transactionResult = await (async () => {
      if (selectedAccount) {
        return await handleTransaction(
          api,
          registerExtrinsic,
          selectedAccount,
          undefined, // Not sure about this, should we be using a signer here?
          emitter,
          {} as VerifyOptions, // Do we need verify options for domain registration?
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

    emitter.emit(ZkVerifyEvents.NewDomain, { domainId });
    return domainId;
  } catch (error) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    emitter.removeAllListeners();
    throw error;
  }
};

export const holdDomain = (domainId: number, emitter: EventEmitter) => {
  // modify state
  // tbd
  const newState = 'Hold'; // placeholder - or 'Removable' depending on pending statements
  // emit event
  emitter.emit(ZkVerifyEvents.DomainStateChanged, {
    domainId,
    newState,
  });
};

export const unregisterDomain = (domainId: number, emitter: EventEmitter) => {
  // modify state
  // tbd
  const newState = 'Removed';
  // emit event
  emitter.emit(ZkVerifyEvents.DomainStateChanged, {
    domainId,
    newState,
  });
};
