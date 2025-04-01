import {
  aggregate,
  holdDomain,
  registerDomain,
  unregisterDomain,
} from '../../../api/domain';

import { ConnectionManager } from '../connection';
import { EventEmitter } from 'events';
import { checkReadOnly } from '../../../utils/helpers';
import {
  AccountConnection,
  WalletConnection,
} from '../../../api/connection/types';
import {
  AggregateTransactionInfo,
  DomainOptions,
  DomainTransactionInfo,
  RegisterDomainTransactionInfo,
} from '../../../types';

export class DomainManager {
  private readonly connectionManager: ConnectionManager;

  /**
   * Creates an instance of DomainManager.
   * @param {ConnectionManager} connectionManager - The connection manager instance.
   */
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Registers a new domain with the given configuration.
   *
   * @param aggregationSize - Number of statements per aggregation.
   * @param queueSize - Max number of aggregations in the queue (default is 16).
   * @param domainOptions - options object containing additional params such as destination and security rules.
   * @param signerAccount - Optional address of the account signing the transaction if multiple have been added to the session.
   * @returns {{ events: EventEmitter; transactionResult: Promise<RegisterDomainTransactionInfo> }}
   * An object containing an event emitter and a promise that resolves to a DomainTransactionInfo object when the call completes.
   * @throws {Error} If the session is read-only.
   */
  registerDomain(
    aggregationSize: number,
    queueSize: number = 16,
    domainOptions: DomainOptions,
    signerAccount?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<RegisterDomainTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return registerDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      aggregationSize,
      queueSize,
      domainOptions,
      signerAccount,
    );
  }

  aggregate(
    domainId: number,
    aggregationId: number,
    signerAccount?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<AggregateTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return aggregate(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
      aggregationId,
      signerAccount,
    );
  }

  /**
   * Places a hold on a domain.
   * @param {number} domainId - The ID of the domain to hold.
   * @param accountAddress - optional address of the account making the transaction
   * @returns {{ events: EventEmitter; transactionResult: Promise<DomainTransactionInfo> }}
   * An object containing an event emitter and a promise that resolves to a DomainTransactionInfo object when the call completes.
   * @throws {Error} If the connection is read-only.
   */
  holdDomain(
    domainId: number,
    accountAddress?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<DomainTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return holdDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
      accountAddress,
    );
  }

  /**
   * Unregisters a domain.
   * @param {number} domainId - The ID of the domain to unregister.
   * @param accountAddress - optional address of the account making the transaction
   * @returns {{ events: EventEmitter; transactionResult: Promise<DomainTransactionInfo> }}
   * An object containing an event emitter and a promise that resolves to a DomainTransactionInfo object when the call completes.
   * @throws {Error} If the connection is read-only.
   */
  unregisterDomain(
    domainId: number,
    accountAddress?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<DomainTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return unregisterDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
      accountAddress,
    );
  }
}
