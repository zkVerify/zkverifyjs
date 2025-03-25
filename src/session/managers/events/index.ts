import {
  subscribeToNewAggregationReceipts,
  unsubscribeFromNewAggregationReceipts,
} from '../../../api/aggregation';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection';
import { NewAggregationReceipt } from '../../../types';
import { NewAggregationEventSubscriptionOptions } from '../../../api/aggregation/types';

export class EventManager {
  private connectionManager: ConnectionManager;
  private emitter?: EventEmitter;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Subscribes to NewAggregationReceipt events.
   * @param {Function} callback - The function to call with the event data when a NewAggregationReceipt event occurs.
   * @param options - NewAggregationEventSubscriptionOptions subscription options
   */
  subscribe(
    callback: (data: NewAggregationReceipt) => void,
    options: NewAggregationEventSubscriptionOptions,
  ): EventEmitter {
    this.emitter = subscribeToNewAggregationReceipts(
      this.connectionManager.api,
      callback,
      options,
    );
    return this.emitter;
  }

  /**
   * Unsubscribes from NewAggregationReceipt events.
   * Emits the 'unsubscribe' event which causes removeAllListeners()
   */
  unsubscribe(): void {
    if (this.emitter) {
      unsubscribeFromNewAggregationReceipts(this.emitter);
    }
  }
}
