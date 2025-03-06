import {
  holdDomain,
  registerDomain,
  unregisterDomain,
} from '../../../api/domain';

import { ConnectionManager } from '../connection';
import { EventEmitter } from 'events';
import { checkReadOnly } from "../../../utils/helpers";
import { AccountConnection, WalletConnection } from "../../../api/connection/types";

export class DomainManager {
  private readonly connectionManager: ConnectionManager;
  public readonly events: EventEmitter;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.events = new EventEmitter();
  }

  async registerDomain(
    aggregationSize: number,
    queueSize: number = 16,
  ): Promise<number> {
    checkReadOnly(this.connectionManager.connectionDetails);

    return registerDomain(
      this.connectionManager.connectionDetails as
          | AccountConnection
          | WalletConnection,
      aggregationSize,
      queueSize,
      this.events,
    );
  }

  async holdDomain(domainId: number): Promise<void> {
    checkReadOnly(this.connectionManager.connectionDetails);

    return holdDomain(
      this.connectionManager.connectionDetails as
          | AccountConnection
          | WalletConnection,
      domainId,
      this.events,
    );
  }

  async unregisterDomain(domainId: number): Promise<void> {
    checkReadOnly(this.connectionManager.connectionDetails);

    return unregisterDomain(
      this.connectionManager.connectionDetails as
          | AccountConnection
          | WalletConnection,
      domainId,
      this.events,
    );
  }
}
