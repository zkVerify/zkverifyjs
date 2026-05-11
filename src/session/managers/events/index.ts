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

type RuntimeEventHandler = (records: EventRecord[]) => void;

export class EventManager {
  private readonly connectionManager: ConnectionManager;
  private readonly emitter: EventEmitter;
  private readonly unsubscribeFunctions: Array<() => void> = [];

  // Per-event-type handlers. We only ever register a SINGLE
  // api.query.system.events callback per EventManager and dispatch from there
  // — registering one polkadot subscription per event type would decode the
  // whole EventRecord vector once per subscriber on every block.
  private readonly runtimeEventHandlers = new Map<
    ZkVerifyEvents,
    RuntimeEventHandler
  >();
  private systemEventsSubscribed = false;
  // Tracks which ZkVerifyEvents the caller has already subscribed to so a
  // second subscribe() call doesn't double-register listeners (and double the
  // codec/event traffic on every block).
  private readonly subscribedEvents = new Set<ZkVerifyEvents>();
  // True after unsubscribe() has been called; pending async unsubscribe fns
  // must be invoked immediately rather than pushed into an array nothing
  // iterates again. Reset to false at the top of subscribe() so the manager
  // can be re-used after an unsubscribe()/subscribe() cycle.
  private isClosed = false;
  // Bumped every time a NEW underlying api.query.system.events subscription
  // is established. The handshake .then handler captures the generation it
  // was set up under and bails (invoking the unsubscribe fn immediately) if
  // the manager has moved on — closing this avoids cross-cycle leaks where
  // an old handshake completes after a re-subscribe and orphans its sub.
  private systemEventsGeneration = 0;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.emitter = new EventEmitter();
  }

  /**
   * Subscribes to specified ZkVerifyEvents.
   * For `NewAggregationReceipt`, `options` can include `domainId` and `aggregationId`.
   * For runtime events (e.g., ProofVerified), options are ignored.
   *
   * Idempotent: subscribing to an event already subscribed to is a no-op for
   * that event (other entries in the same call are still processed).
   *
   * @param subscriptions - List of events to subscribe to with optional callback and filtering options.
   * @returns EventEmitter to allow listening to additional internal events (e.g., `Unsubscribe`).
   */
  subscribe(subscriptions?: SubscriptionEntry[]): EventEmitter {
    // Allow re-subscribing after a previous unsubscribe() — the generation
    // counter on system.events guards stale handshakes from the prior cycle.
    this.isClosed = false;
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
      if (this.subscribedEvents.has(event)) {
        return;
      }

      switch (event) {
        case ZkVerifyEvents.NewAggregationReceipt:
          this.subscribedEvents.add(event);
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
        case ZkVerifyEvents.CannotAggregate:
          this.subscribedEvents.add(event);
          this._registerRuntimeEvent(api, event, callback);
          break;

        default:
          throw new Error(`Unsupported event type for subscription: ${event}`);
      }
    });

    return this.emitter;
  }

  /**
   * Registers a per-event handler against the shared system.events
   * subscription, lazily creating that subscription on first use.
   */
  private _registerRuntimeEvent(
    api: ApiPromise,
    eventType: ZkVerifyEvents,
    callback?: (data: unknown) => void,
  ): void {
    const matchMap: Partial<Record<ZkVerifyEvents, string | RegExp>> = {
      [ZkVerifyEvents.ProofVerified]: /::ProofVerified/,
      [ZkVerifyEvents.CannotAggregate]: 'aggregate::CannotAggregate',
      [ZkVerifyEvents.NewProof]: 'aggregate::NewProof',
      [ZkVerifyEvents.VkRegistered]: /::VkRegistered/,
      [ZkVerifyEvents.AggregationComplete]: 'aggregate::AggregationComplete',
      [ZkVerifyEvents.NewDomain]: 'aggregate::NewDomain',
      [ZkVerifyEvents.DomainStateChanged]: 'aggregate::DomainStateChanged',
    };

    const handler: RuntimeEventHandler = (records) => {
      for (const { event, phase } of records) {
        const key = `${event.section}::${event.method}`;
        const expected = matchMap[eventType];
        if (!expected) continue;

        const matches =
          (typeof expected === 'string' && key === expected) ||
          (expected instanceof RegExp && expected.test(key));
        if (!matches) continue;

        const parsedPhase = phase.toJSON ? phase.toJSON() : phase.toString();
        const eventPayload = {
          event: eventType,
          data: event.data.toHuman?.() ?? event.data.toString(),
          phase: parsedPhase,
        };

        this.emitter.emit(eventType, eventPayload);
        if (callback) callback(eventPayload);
      }
    };

    this.runtimeEventHandlers.set(eventType, handler);
    this._ensureSystemEventsSubscription(api);
  }

  private _ensureSystemEventsSubscription(api: ApiPromise): void {
    if (this.systemEventsSubscribed) return;
    this.systemEventsSubscribed = true;
    const myGeneration = ++this.systemEventsGeneration;

    const subscriptionResult = api.query.system.events(
      (records: EventRecord[]) => {
        // If a newer cycle has replaced this subscription (or the manager
        // closed) but the polkadot unsubscribe fn hasn't fired yet, drop
        // these records — the handlers Map may belong to a different cycle.
        if (myGeneration !== this.systemEventsGeneration) return;
        for (const handler of this.runtimeEventHandlers.values()) {
          try {
            handler(records);
          } catch (err) {
            this.emitter.emit(ZkVerifyEvents.ErrorEvent, err);
          }
        }
      },
    );

    const handleUnsubscribeFn = (fn: unknown) => {
      if (typeof fn !== 'function') return;
      // Invoke the unsubscribe fn immediately if either (a) the manager has
      // been closed since the handshake started, or (b) a newer system.events
      // subscription has replaced this one. Either case would otherwise leave
      // the polkadot subscription orphaned.
      if (this.isClosed || myGeneration !== this.systemEventsGeneration) {
        try {
          (fn as () => void)();
        } catch (error) {
          console.debug('Error during late runtime-event cleanup:', error);
        }
        return;
      }
      this.unsubscribeFunctions.push(fn as () => void);
    };

    if (subscriptionResult) {
      if (typeof subscriptionResult === 'function') {
        handleUnsubscribeFn(subscriptionResult);
      } else if (typeof subscriptionResult.then === 'function') {
        subscriptionResult.then(handleUnsubscribeFn).catch((error: unknown) => {
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
          const data = event?.data;
          const receiptData = Array.isArray(data)
            ? {
                domainId: data[0],
                aggregationId: data[1],
                receipt: data[2],
              }
            : data;

          if (
            event &&
            receiptData &&
            receiptData.domainId !== undefined &&
            receiptData.aggregationId !== undefined &&
            receiptData.receipt !== undefined
          ) {
            const result: NewAggregationReceipt = {
              blockHash: event.blockHash ?? null,
              domainId: Number(receiptData.domainId),
              aggregationId: Number(receiptData.aggregationId),
              receipt: String(receiptData.receipt),
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
    this.isClosed = true;
    // Bumping the generation invalidates any in-flight system.events handshake
    // from this cycle — when its .then resolves, handleUnsubscribeFn will see
    // the mismatch and invoke the unsubscribe fn immediately.
    this.systemEventsGeneration += 1;

    this.unsubscribeFunctions.forEach((unsubscribeFn) => {
      try {
        unsubscribeFn();
      } catch (error) {
        console.debug('Error during subscription cleanup:', error);
      }
    });
    this.unsubscribeFunctions.length = 0;
    this.runtimeEventHandlers.clear();
    this.subscribedEvents.clear();
    this.systemEventsSubscribed = false;

    unsubscribe(this.emitter);
  }
}
