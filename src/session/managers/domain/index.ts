import {
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
   * Registers a new domain with the given aggregation and queue sizes.
   * @param {number} aggregationSize - The size of the aggregation.
   * @param {number} [queueSize=16] - The queue size (default is 16).
   * @returns {{ events: EventEmitter; domainIdPromise: Promise<number> }}
   * An object containing an event emitter and a promise that resolves to the domain ID.
   * @throws {Error} If the connection is read-only.
   */
  registerDomain(
    aggregationSize: number,
    queueSize: number = 16,
  ): { events: EventEmitter; domainIdPromise: Promise<number> } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return registerDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      aggregationSize,
      queueSize,
    );
  }

  /**
   * Places a hold on a domain.
   * @param {number} domainId - The ID of the domain to hold.
   * @returns {{ events: EventEmitter; result: Promise<boolean> }}
   * An object containing an event emitter and a promise that resolves to a boolean indicating success.
   * @throws {Error} If the connection is read-only.
   */
  holdDomain(domainId: number): {
    events: EventEmitter;
    result: Promise<boolean>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return holdDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
    );
  }

  /**
   * Unregisters a domain.
   * @param {number} domainId - The ID of the domain to unregister.
   * @returns {{ events: EventEmitter; result: Promise<boolean> }}
   * An object containing an event emitter and a promise that resolves to a boolean indicating success.
   * @throws {Error} If the connection is read-only.
   */
  unregisterDomain(domainId: number): {
    events: EventEmitter;
    result: Promise<boolean>;
  } {
    checkReadOnly(this.connectionManager.connectionDetails);

    return unregisterDomain(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      domainId,
    );
  }
}
