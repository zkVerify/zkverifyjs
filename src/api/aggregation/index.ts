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
 * Subscribes to `aggregation.NewAggregationReceipt` events and triggers the provided callback.
 *
 * - If both `domainId` and `aggregationId` are provided, the listener stops after the matching receipt is found.
 * - If only `domainId` is provided, listens indefinitely for all receipts within that domain.
 * - If neither is provided, listens to all receipts across all domains.
 * - Throws if `aggregationId` is provided without a `domainId`.
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
    let unsubscribeFinalizedHeads: (() => void) | undefined;
    let isResolved = false;
    let isRejected = false;
    // Set the moment cleanup() runs so a late-resolving subscribe Promise can
    // invoke its unsubscribe fn instead of orphaning the polkadot subscription.
    let wasCleanedUp = false;
    let unregisterCleanup: (() => void) | undefined;

    const cleanup = () => {
      wasCleanedUp = true;
      unregisterCleanup?.();
      unregisterCleanup = undefined;
      emitter.removeListener(ZkVerifyEvents.Unsubscribe, cleanup);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (unsubscribeFinalizedHeads) {
        try {
          unsubscribeFinalizedHeads();
        } catch (err) {
          console.debug('Error during finalized heads cleanup:', err);
        }
        unsubscribeFinalizedHeads = undefined;
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

    unregisterCleanup = registerCleanup(emitter, cleanup);
    emitter.once(ZkVerifyEvents.Unsubscribe, cleanup);

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

      timeoutId = setTimeout(() => {
        unsubscribe(emitter);
        safeReject(
          new Error(
            `Timeout exceeded: No event received within ${timeoutValue} ms`,
          ),
        );
      }, timeoutValue);
    }

    try {
      const subscriptionResult = api.rpc.chain.subscribeFinalizedHeads(
        async (header) => {
          const blockHash = header.hash.toHex();
          // Query the storage at a specific block hash without materializing a
          // full ApiDecoration via api.at() — that creates per-block registry
          // overhead and accumulates polkadot-api caches in long-lived subs.
          const events = (await api.query.system.events.at(
            blockHash,
          )) as unknown as Vec<EventRecord>;

          events.forEach((record) => {
            const { event, phase } = record;

            if (
              event.section === 'aggregate' &&
              event.method === 'NewAggregationReceipt'
            ) {
              let currentDomainId: string | undefined;
              let currentAggregationId: string | undefined;

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

              try {
                currentDomainId = event.data[0]?.toString();
                currentAggregationId = event.data[1]?.toString();

                if (!currentDomainId || !currentAggregationId) {
                  emitter.emit(
                    ZkVerifyEvents.ErrorEvent,
                    new Error(
                      'Event data is missing required fields: domainId or aggregationId.',
                    ),
                  );
                  safeReject(
                    new Error(
                      'Event data is missing required fields: domainId or aggregationId.',
                    ),
                  );
                  return;
                }
              } catch (error) {
                emitter.emit(ZkVerifyEvents.ErrorEvent, error);
                safeReject(error);
                return;
              }

              if (!options || (!aggregationId && !domainId)) {
                emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
                callback(eventObject);
              } else if (
                domainId &&
                !aggregationId &&
                domainId === currentDomainId
              ) {
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
          });
        },
      );

      const handleUnsubscribeFn = (fn: unknown) => {
        if (typeof fn !== 'function') return;
        // If cleanup already ran (e.g. user called unsubscribe(emitter) before
        // the subscribe handshake completed), invoke the unsubscribe fn now to
        // avoid orphaning the polkadot subscription.
        if (wasCleanedUp) {
          try {
            (fn as () => void)();
          } catch (err) {
            console.debug('Error during late finalized heads cleanup:', err);
          }
          return;
        }
        unsubscribeFinalizedHeads = fn as () => void;
      };

      if (typeof subscriptionResult === 'function') {
        handleUnsubscribeFn(subscriptionResult);
      } else if (
        subscriptionResult &&
        typeof subscriptionResult.then === 'function'
      ) {
        subscriptionResult.then(handleUnsubscribeFn).catch((error: unknown) => {
          if (!isResolved && !isRejected) {
            emitter.emit(ZkVerifyEvents.ErrorEvent, error);
            safeReject(error);
          }
        });
      }
    } catch (error) {
      emitter.emit(ZkVerifyEvents.ErrorEvent, error);
      safeReject(error);
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
