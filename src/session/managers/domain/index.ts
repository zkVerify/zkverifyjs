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
  private readonly events: EventEmitter;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.events = new EventEmitter();
  }

  async registerDomain(
      aggregationSize: number,
      queueSize: number = 16,
  ): Promise<{ events: EventEmitter; domainId: number }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    const domainId = await registerDomain(
        this.connectionManager.connectionDetails as
            | AccountConnection
            | WalletConnection,
        aggregationSize,
        queueSize,
        this.events,
    );

    return { events: this.events, domainId };
  }

  async holdDomain(domainId: number): Promise<{ events: EventEmitter }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    await holdDomain(
        this.connectionManager.connectionDetails as
            | AccountConnection
            | WalletConnection,
        domainId,
        this.events,
    );

    return { events: this.events };
  }

  async unregisterDomain(domainId: number): Promise<{ events: EventEmitter }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    await unregisterDomain(
        this.connectionManager.connectionDetails as
            | AccountConnection
            | WalletConnection,
        domainId,
        this.events,
    );

    return { events: this.events };
  }
}
