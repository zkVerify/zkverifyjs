import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Vec } from '@polkadot/types-codec';
import { EventEmitter } from 'events';
import { ZkVerifyEvents } from '../../enums';
import { NewAggregationEventSubscriptionOptions } from './types';
import { Codec } from '@polkadot/types/types';

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

    const cleanup = () => {
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
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
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

    (emitter as EventEmitter & { _cleanup?: () => void })._cleanup = cleanup;

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
          const apiAt = await api.at(blockHash);
          const events =
            (await apiAt.query.system.events()) as unknown as Vec<EventRecord>;

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
                cleanup();
                safeResolve(emitter);
                return;
              }
            }
          });
        },
      );

      if (typeof subscriptionResult === 'function') {
        unsubscribeFinalizedHeads = subscriptionResult;
      } else if (
        subscriptionResult &&
        typeof subscriptionResult.then === 'function'
      ) {
        subscriptionResult
          .then((unsubscribeFn: () => void) => {
            if (
              !isResolved &&
              !isRejected &&
              typeof unsubscribeFn === 'function'
            ) {
              unsubscribeFinalizedHeads = unsubscribeFn;
            }
          })
          .catch((error: unknown) => {
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
  const emitterWithCleanup = emitter as EventEmitter & {
    _cleanup?: () => void;
  };
  if (emitterWithCleanup._cleanup) {
    emitterWithCleanup._cleanup();
    delete emitterWithCleanup._cleanup;
  }

  emitter.emit(ZkVerifyEvents.Unsubscribe);
  emitter.removeAllListeners();
}
