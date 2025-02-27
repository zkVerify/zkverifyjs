import {
  holdDomain,
  registerDomain,
  unregisterDomain,
} from '../../../api/domain';

import { ConnectionManager } from '../connection';
import { EventEmitter } from 'events';

// That file will contain most of the logic similar to all the other api files, see verify for example of how events are used and fired.
export class DomainManager {
  private readonly connectionManager: ConnectionManager;
  private eventEmitter: EventEmitter;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.eventEmitter = new EventEmitter();
  }

  async registerDomain(
    aggregationSize: number,
    queueSize: number = 16,
  ): Promise<number> {
    return await registerDomain(
      this.connectionManager.connectionDetails,
      aggregationSize,
      queueSize,
      this.eventEmitter,
    );
  }

  async holdDomain(domainId: number): Promise<void> {
    return holdDomain(domainId, this.eventEmitter);
  }

  async unregisterDomain(domainId: number): Promise<void> {
    return unregisterDomain(domainId, this.eventEmitter);
  }
}
