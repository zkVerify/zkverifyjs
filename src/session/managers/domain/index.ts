import {
  holdDomain,
  registerDomain,
  unregisterDomain,
} from '../../../api/domain';

import { ConnectionManager } from '../connection';
import { EventEmitter } from 'events';

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
    return registerDomain(
      this.connectionManager.connectionDetails,
      aggregationSize,
      queueSize,
      this.events,
    );
  }

  async holdDomain(domainId: number): Promise<void> {
    return holdDomain(
      this.connectionManager.connectionDetails,
      domainId,
      this.events,
    );
  }

  async unregisterDomain(domainId: number): Promise<void> {
    return unregisterDomain(
      this.connectionManager.connectionDetails,
      domainId,
      this.events,
    );
  }
}
