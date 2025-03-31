import {
  subscribeToNewAggregationReceipts,
  unsubscribeFromNewAggregationReceipts,
} from '../../../api/aggregation';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection';
import { PUBLIC_ZK_VERIFY_EVENTS, ZkVerifyEvents } from '../../../enums';
import { NewAggregationEventSubscriptionOptions } from '../../../api/aggregation/types';
import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';

interface SubscriptionEntry {
  event: ZkVerifyEvents;
  callback?: (data: unknown) => void;
  options?: NewAggregationEventSubscriptionOptions | undefined;
}

export class EventManager {
  private readonly connectionManager: ConnectionManager;
  private readonly emitter: EventEmitter;

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
    api.query.system
      .events((records: EventRecord[]) => {
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
            [ZkVerifyEvents.DomainStateChanged]:
              'aggregate::DomainStateChanged',
          };

          const expected = matchMap[eventType];
          if (
            expected &&
            ((typeof expected === 'string' && key === expected) ||
              (expected instanceof RegExp && expected.test(key)))
          ) {
            const parsedPhase = phase.toJSON
              ? phase.toJSON()
              : phase.toString();

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
      })
      .catch((error) => {
        this.emitter.emit(ZkVerifyEvents.ErrorEvent, error);
      });
  }

  /**
   * Unsubscribes from all active subscriptions.
   */
  unsubscribe(): void {
    unsubscribeFromNewAggregationReceipts(this.emitter);
  }
}
