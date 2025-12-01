import {
  subscribeToNewAggregationReceipts,
  unsubscribe,
} from '../../../api/aggregation';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection';
import { PUBLIC_ZK_VERIFY_EVENTS, ZkVerifyEvents } from '../../../enums';
import { NewAggregationEventSubscriptionOptions } from '../../../api/aggregation/types';
import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import {
  NewAggregationReceipt,
  NewAggregationReceiptEvent,
  SubscriptionEntry,
} from '../../../types';

export class EventManager {
  private readonly connectionManager: ConnectionManager;
  private readonly emitter: EventEmitter;
  private readonly unsubscribeFunctions: Array<() => void> = [];

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.emitter = new EventEmitter();
  }

  /**
   * Subscribes to specified ZkVerifyEvents.
   * For `NewAggregationReceipt`, `options` can include `domainId` and `aggregationId`.
   * For runtime events (e.g., ProofVerified), options are ignored.
   *
   * @param subscriptions - List of events to subscribe to with optional callback and filtering options.
   * @returns EventEmitter to allow listening to additional internal events (e.g., `Unsubscribe`).
   */
  subscribe(subscriptions?: SubscriptionEntry[]): EventEmitter {
    const { api } = this.connectionManager;

    const eventsToSubscribe: SubscriptionEntry[] = subscriptions?.length
      ? subscriptions
      : PUBLIC_ZK_VERIFY_EVENTS.map(
          (event): SubscriptionEntry => ({
            event,
            callback: undefined,
            options:
              event === ZkVerifyEvents.NewAggregationReceipt
                ? (undefined as NewAggregationEventSubscriptionOptions)
                : undefined,
          }),
        );

    eventsToSubscribe.forEach(({ event, callback, options }) => {
      switch (event) {
        case ZkVerifyEvents.NewAggregationReceipt:
          subscribeToNewAggregationReceipts(
            api,
            (data) => {
              this.emitter.emit(event, data);
              if (callback) callback(data);
            },
            options as NewAggregationEventSubscriptionOptions,
            this.emitter,
          );
          break;

        case ZkVerifyEvents.ProofVerified:
        case ZkVerifyEvents.NewProof:
        case ZkVerifyEvents.VkRegistered:
        case ZkVerifyEvents.NewDomain:
        case ZkVerifyEvents.DomainStateChanged:
        case ZkVerifyEvents.AggregationComplete:
          this._subscribeToRuntimeEvent(api, event, callback);
          break;

        default:
          throw new Error(`Unsupported event type for subscription: ${event}`);
      }
    });

    return this.emitter;
  }

  /**
   * Subscribes to on-chain runtime events using api.query.system.events
   */
  private _subscribeToRuntimeEvent(
    api: ApiPromise,
    eventType: ZkVerifyEvents,
    callback?: (data: unknown) => void,
  ) {
    const unsubscribeFn = api.query.system.events((records: EventRecord[]) => {
      for (const { event, phase } of records) {
        const key = `${event.section}::${event.method}`;

        const matchMap: Partial<Record<ZkVerifyEvents, string | RegExp>> = {
          [ZkVerifyEvents.ProofVerified]: /::ProofVerified/,
          [ZkVerifyEvents.CannotAggregate]: 'aggregate::CannotAggregate',
          [ZkVerifyEvents.NewProof]: 'aggregate::NewProof',
          [ZkVerifyEvents.VkRegistered]: /::VkRegistered/,
          [ZkVerifyEvents.AggregationComplete]:
            'aggregate::AggregationComplete',
          [ZkVerifyEvents.NewDomain]: 'aggregate::NewDomain',
          [ZkVerifyEvents.DomainStateChanged]: 'aggregate::DomainStateChanged',
        };

        const expected = matchMap[eventType];
        if (
          expected &&
          ((typeof expected === 'string' && key === expected) ||
            (expected instanceof RegExp && expected.test(key)))
        ) {
          const parsedPhase = phase.toJSON ? phase.toJSON() : phase.toString();

          const eventPayload = {
            event: eventType,
            data: event.data.toHuman?.() ?? event.data.toString(),
            phase: parsedPhase,
          };

          this.emitter.emit(eventType, eventPayload);

          if (callback) {
            callback(eventPayload);
          }
        }
      }
    });

    if (unsubscribeFn) {
      if (typeof unsubscribeFn === 'function') {
        this.unsubscribeFunctions.push(unsubscribeFn);
      } else if (unsubscribeFn && typeof unsubscribeFn.then === 'function') {
        unsubscribeFn
          .then((fn) => {
            if (typeof fn === 'function') {
              this.unsubscribeFunctions.push(fn);
            }
          })
          .catch((error: unknown) => {
            this.emitter.emit(ZkVerifyEvents.ErrorEvent, error);
          });
      }
    }
  }

  /**
   * Waits for a specific `NewAggregationReceipt` event and returns the result as a NewAggregationReceipt object.
   *
   * @param domainId - The domain ID to listen for.
   * @param aggregationId - The aggregation ID to listen for.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns {Promise<NewAggregationReceipt>} Resolves with the event data when found, or rejects on timeout/error.
   */
  async waitForAggregationReceipt(
    domainId: number,
    aggregationId: number,
    timeout?: number,
  ): Promise<NewAggregationReceipt> {
    const { api } = this.connectionManager;

    const options = { domainId, aggregationId, timeout };

    return new Promise((resolve, reject) => {
      subscribeToNewAggregationReceipts(
        api,
        (eventObject: unknown) => {
          const event = eventObject as NewAggregationReceiptEvent;

          if (
            event &&
            event.data &&
            event.data.domainId &&
            event.data.aggregationId &&
            event.data.receipt
          ) {
            const result: NewAggregationReceipt = {
              blockHash: event.blockHash ?? null,
              domainId: Number(event.data.domainId),
              aggregationId: Number(event.data.aggregationId),
              receipt: String(event.data.receipt),
            };

            resolve(result);
          } else {
            reject(new Error('Invalid event data structure'));
          }
        },
        options,
        this.emitter,
      ).catch(reject);
    });
  }

  /**
   * Unsubscribes from all active subscriptions.
   */
  unsubscribe(): void {
    this.unsubscribeFunctions.forEach((unsubscribeFn) => {
      try {
        unsubscribeFn();
      } catch (error) {
        console.debug('Error during subscription cleanup:', error);
      }
    });
    this.unsubscribeFunctions.length = 0;

    unsubscribe(this.emitter);
  }
}
