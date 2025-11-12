import {
  addDomainSubmitters,
  aggregate,
  holdDomain,
  registerDomain,
  removeDomainSubmitters,
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

  /**
   * Adds submitters to the allowlist for a domain.
   * Only available for domains configured with ProofSecurityRules.OnlyAllowlisted.
   * Requires runtime version 1.3.0 or later.
   * @param {number} domainId - The ID of the domain.
   * @param {string[]} submitters - Array of account addresses to add to the allowlist.
   * @param {string} [signerAccount] - Optional address of the account signing the transaction.
   * @returns {{ events: EventEmitter; transactionResult: Promise<DomainTransactionInfo> }}
   * @throws {Error} If the connection is read-only or runtime version is too old.
   */
  addDomainSubmitters(
    domainId: number,
    submitters: string[],
    signerAccount?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<DomainTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return addDomainSubmitters(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
      submitters,
      signerAccount,
    );
  }

  /**
   * Removes submitters from the allowlist for a domain.
   * Only available for domains configured with ProofSecurityRules.OnlyAllowlisted.
   * Requires runtime version 1.3.0 or later.
   * @param {number} domainId - The ID of the domain.
   * @param {string[]} submitters - Array of account addresses to remove from the allowlist.
   * @param {string} [signerAccount] - Optional address of the account signing the transaction.
   * @returns {{ events: EventEmitter; transactionResult: Promise<DomainTransactionInfo> }}
   * @throws {Error} If the connection is read-only or runtime version is too old.
   */
  removeDomainSubmitters(
    domainId: number,
    submitters: string[],
    signerAccount?: string,
  ): {
    events: EventEmitter;
    transactionResult: Promise<DomainTransactionInfo>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return removeDomainSubmitters(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
      submitters,
      signerAccount,
    );
  }
}
