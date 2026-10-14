import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Vec } from '@polkadot/types-codec';
import { EventEmitter } from 'events';
import { ZkVerifyEvents } from '../../enums.js';
import { NewAggregationEventSubscriptionOptions } from './types.js';
import { Codec } from '@polkadot/types/types';

type EmitterWithCleanups = EventEmitter & {
  _cleanups?: Array<() => void>;
};

/**
 * Rejection reason for a receipt subscription ended by an explicit
 * `unsubscribe(emitter)` rather than by a failure.
 */
export class SubscriptionCancelledError extends Error {
  constructor() {
    super('Unsubscribed before a matching NewAggregationReceipt was received.');
    this.name = 'SubscriptionCancelledError';
  }
}

function registerCleanup(
  emitter: EventEmitter,
  cleanup: () => void,
): () => void {
  const e = emitter as EmitterWithCleanups;
  if (!e._cleanups) e._cleanups = [];
  e._cleanups.push(cleanup);

  return () => {
    const index = e._cleanups?.indexOf(cleanup) ?? -1;
    if (index >= 0) {
      e._cleanups?.splice(index, 1);
    }
  };
}

/**
 * A consumer of the per-block finalized event vector.
 */
interface FinalizedEventsSubscriber {
  onEvents: (blockHash: string, events: Vec<EventRecord>) => void;
  onError: (error: unknown) => void;
}

/**
 * One `subscribeFinalizedHeads` subscription (and one `system.events.at` query per
 * block) fanned out to every concurrent subscriber on the same `api`.
 */
interface FinalizedEventsFeed {
  subscribers: Set<FinalizedEventsSubscriber>;
  /** Subscribers that have received at least one block from this feed. */
  delivered: WeakSet<FinalizedEventsSubscriber>;
  /** Most recent finalized block, replayed to subscribers that join later. */
  latest?: { blockHash: string; events: Vec<EventRecord> };
  unsubscribe?: () => void;
  closed: boolean;
}

const finalizedEventsFeeds = new WeakMap<ApiPromise, FinalizedEventsFeed>();

const closeFeed = (api: ApiPromise, feed: FinalizedEventsFeed): void => {
  if (feed.closed) return;
  feed.closed = true;
  feed.latest = undefined;
  if (finalizedEventsFeeds.get(api) === feed) {
    finalizedEventsFeeds.delete(api);
  }
  if (feed.unsubscribe) {
    try {
      feed.unsubscribe();
    } catch (err) {
      console.debug('Error during finalized heads cleanup:', err);
    }
    feed.unsubscribe = undefined;
  }
};

const deliver = (
  feed: FinalizedEventsFeed,
  subscriber: FinalizedEventsSubscriber,
  blockHash: string,
  events: Vec<EventRecord>,
): void => {
  if (!feed.subscribers.has(subscriber)) return;
  feed.delivered.add(subscriber);
  try {
    subscriber.onEvents(blockHash, events);
  } catch (error) {
    subscriber.onError(error);
  }
};

const createFeed = (api: ApiPromise): FinalizedEventsFeed => {
  const feed: FinalizedEventsFeed = {
    subscribers: new Set(),
    delivered: new WeakSet(),
    closed: false,
  };

  const broadcastError = (error: unknown): void => {
    for (const subscriber of Array.from(feed.subscribers)) {
      subscriber.onError(error);
    }
  };

  const onFinalizedHead = async (header: {
    hash: { toHex: () => string };
  }): Promise<void> => {
    if (feed.closed) return;

    const blockHash = header.hash.toHex();
    let events: Vec<EventRecord>;

    try {
      // Query the storage at a specific block hash without materializing a
      // full ApiDecoration via api.at() — that creates per-block registry
      // overhead and accumulates polkadot-api caches in long-lived subs.
      events = (await api.query.system.events.at(
        blockHash,
      )) as unknown as Vec<EventRecord>;
    } catch (error) {
      broadcastError(error);
      return;
    }

    if (feed.closed) return;

    feed.latest = { blockHash, events };

    // Snapshot: a subscriber may resolve and remove itself while being notified.
    for (const subscriber of Array.from(feed.subscribers)) {
      deliver(feed, subscriber, blockHash, events);
    }
  };

  const handleUnsubscribeFn = (fn: unknown): void => {
    if (typeof fn !== 'function') return;
    // All subscribers may have left before the handshake completed.
    if (feed.closed) {
      try {
        (fn as () => void)();
      } catch (err) {
        console.debug('Error during late finalized heads cleanup:', err);
      }
      return;
    }
    feed.unsubscribe = fn as () => void;
  };

  try {
    const subscriptionResult =
      api.rpc.chain.subscribeFinalizedHeads(onFinalizedHead);

    if (typeof subscriptionResult === 'function') {
      handleUnsubscribeFn(subscriptionResult);
    } else if (
      subscriptionResult &&
      typeof subscriptionResult.then === 'function'
    ) {
      subscriptionResult.then(handleUnsubscribeFn).catch((error: unknown) => {
        broadcastError(error);
        closeFeed(api, feed);
      });
    }
  } catch (error) {
    // Deferred so the subscriber registering right after creation is notified.
    queueMicrotask(() => {
      broadcastError(error);
      closeFeed(api, feed);
    });
  }

  return feed;
};

/**
 * Subscribes to the finalized event vector of each new block, sharing a single
 * underlying `subscribeFinalizedHeads` subscription across all subscribers on the
 * same `api`.
 *
 * @returns A function that removes this subscriber; the underlying subscription is
 *   released when the last subscriber leaves.
 */
export function subscribeFinalizedEvents(
  api: ApiPromise,
  subscriber: FinalizedEventsSubscriber,
): () => void {
  let feed = finalizedEventsFeeds.get(api);
  if (!feed || feed.closed) {
    feed = createFeed(api);
    finalizedEventsFeeds.set(api, feed);
  }

  const activeFeed = feed;
  activeFeed.subscribers.add(subscriber);

  // polkadot-js replays the latest finalized head to each new heads subscriber;
  // a subscriber joining an existing feed gets the same starting point.
  queueMicrotask(() => {
    const latest = activeFeed.latest;
    if (latest && !activeFeed.delivered.has(subscriber)) {
      deliver(activeFeed, subscriber, latest.blockHash, latest.events);
    }
  });

  return () => {
    activeFeed.subscribers.delete(subscriber);
    if (activeFeed.subscribers.size === 0) {
      closeFeed(api, activeFeed);
    }
  };
}

/**
 * Subscribes to `aggregation.NewAggregationReceipt` events and triggers the provided callback.
 *
 * - If both `domainId` and `aggregationId` are provided, the listener stops after the matching receipt is found.
 * - If only `domainId` is provided, listens indefinitely for all receipts within that domain.
 * - If neither is provided, listens to all receipts across all domains.
 * - Throws if `aggregationId` is provided without a `domainId`.
 *
 * Failures reject the returned promise; an explicit `unsubscribe(emitter)` rejects
 * it with `SubscriptionCancelledError`.
 *
 * @param {ApiPromise} api - The Polkadot.js API instance.
 * @param callback
 * @param options - NewAggregationEventSubscriptionOptions containing domainId, aggregationId and optional timeout.
 * @param emitter - EventEmitter
 * @returns {EventEmitter} EventEmitter for listening to emitted events and unsubscribing.
 */
export async function subscribeToNewAggregationReceipts(
  api: ApiPromise,
  callback: (data: unknown) => void,
  options: NewAggregationEventSubscriptionOptions = undefined,
  emitter: EventEmitter,
): Promise<EventEmitter> {
  return new Promise((resolve, reject) => {
    const DEFAULT_MATCH_TIMEOUT = 180000;

    let domainId: string | undefined = undefined;
    let aggregationId: string | undefined = undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let unsubscribeFeed: (() => void) | undefined;
    let isResolved = false;
    let isRejected = false;
    let unregisterCleanup: (() => void) | undefined;

    // Releases only what this subscription owns: `emitter` is shared with other
    // subscriptions and with the consumer's own listeners.
    const cleanup = () => {
      unregisterCleanup?.();
      unregisterCleanup = undefined;
      emitter.removeListener(ZkVerifyEvents.Unsubscribe, cancel);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (unsubscribeFeed) {
        const release = unsubscribeFeed;
        unsubscribeFeed = undefined;
        release();
      }
    };

    const safeResolve = (value: EventEmitter) => {
      if (!isResolved && !isRejected) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    const safeReject = (error: unknown) => {
      if (!isResolved && !isRejected) {
        isRejected = true;
        cleanup();
        reject(error);
      }
    };

    // Failures are reported through the returned promise only; callers that
    // surface them as events do so in one place.
    const fail = (error: unknown) => {
      safeReject(error);
    };

    const cancel = () => {
      safeReject(new SubscriptionCancelledError());
    };

    unregisterCleanup = registerCleanup(emitter, cancel);
    emitter.once(ZkVerifyEvents.Unsubscribe, cancel);

    if (options) {
      domainId = options.domainId?.toString().trim();
      if ('aggregationId' in options) {
        aggregationId = options.aggregationId?.toString().trim();

        if (!domainId) {
          safeReject(
            new Error(
              'Cannot filter by aggregationId without also providing domainId.',
            ),
          );
          return;
        }
      }
    }

    if (aggregationId && domainId) {
      const timeoutValue =
        options && 'timeout' in options && typeof options.timeout === 'number'
          ? options.timeout
          : DEFAULT_MATCH_TIMEOUT;

      // A timeout ends this wait only.
      timeoutId = setTimeout(() => {
        safeReject(
          new Error(
            `Timeout exceeded: No event received within ${timeoutValue} ms`,
          ),
        );
      }, timeoutValue);
    }

    const onEvents = (blockHash: string, events: Vec<EventRecord>) => {
      for (const record of events) {
        const { event, phase } = record;

        if (
          event.section !== 'aggregate' ||
          event.method !== 'NewAggregationReceipt'
        ) {
          continue;
        }

        const eventData = event.data.toHuman
          ? event.data.toHuman()
          : Array.from(event.data as Iterable<Codec>, (item: Codec) =>
              item.toString(),
            );

        const eventObject = {
          event: ZkVerifyEvents.NewAggregationReceipt,
          blockHash,
          data: eventData,
          phase:
            phase && typeof phase.toJSON === 'function'
              ? phase.toJSON()
              : phase?.toString() || '',
        };

        const currentDomainId = event.data[0]?.toString();
        const currentAggregationId = event.data[1]?.toString();

        if (!currentDomainId || !currentAggregationId) {
          fail(
            new Error(
              'Event data is missing required fields: domainId or aggregationId.',
            ),
          );
          return;
        }

        if (!options || (!aggregationId && !domainId)) {
          emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
          callback(eventObject);
        } else if (domainId && !aggregationId && domainId === currentDomainId) {
          emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
          callback(eventObject);
        } else if (
          domainId === currentDomainId &&
          currentAggregationId === aggregationId
        ) {
          emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
          callback(eventObject);
          safeResolve(emitter);
          return;
        }
      }
    };

    try {
      unsubscribeFeed = subscribeFinalizedEvents(api, {
        onEvents,
        onError: fail,
      });
    } catch (error) {
      fail(error);
    }

    return emitter;
  });
}

/**
 * Unsubscribes from all event tracking.
 *
 * - Emits a `ZkVerifyEvents.Unsubscribe` event before removing all listeners.
 * - Use this to manually stop listening when not auto-unsubscribing on matched receipts.
 *
 * @param {EventEmitter} emitter - The EventEmitter instance returned by the subscription.
 */
export function unsubscribe(emitter: EventEmitter): void {
  const e = emitter as EmitterWithCleanups;
  if (e._cleanups && e._cleanups.length > 0) {
    // Run all registered cleanups; clear before running so re-entrant emits
    // (e.g. from inside a cleanup) can't see stale entries.
    const cleanups = e._cleanups;
    e._cleanups = [];
    for (const c of cleanups) {
      try {
        c();
      } catch (err) {
        console.debug('Error during emitter cleanup:', err);
      }
    }
  }

  emitter.emit(ZkVerifyEvents.Unsubscribe);
  emitter.removeAllListeners();
}
