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

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

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
