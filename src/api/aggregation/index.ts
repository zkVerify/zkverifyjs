import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { EventEmitter } from 'events';
import { ZkVerifyEvents } from '../../enums';
import { NewAggregationEventSubscriptionOptions } from './types';

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
 * @param options
 * @param emitter
 * @returns {EventEmitter} EventEmitter for listening to emitted events and unsubscribing.
 */
export function subscribeToNewAggregationReceipts(
  api: ApiPromise,
  callback: (data: unknown) => void,
  options: NewAggregationEventSubscriptionOptions = undefined,
  emitter: EventEmitter,
): EventEmitter {
  let domainId: string | undefined = undefined;
  let aggregationId: string | undefined = undefined;

  if (options) {
    domainId = options.domainId?.toString();
    if ('aggregationId' in options) {
      aggregationId = options.aggregationId?.toString();

      if (domainId === undefined) {
        throw new Error(
          'Cannot filter by aggregationId without also providing domainId.',
        );
      }
    }
  }

  api.query.system
    .events((events: EventRecord[]) => {
      events.forEach((record: EventRecord) => {
        const { event, phase } = record;

        if (
          event.section === 'aggregate' &&
          event.method === 'NewAggregationReceipt'
        ) {
          let currentDomainId: string | undefined;
          let currentAggregationId: string | undefined;
          const eventData = event.data.toHuman
            ? event.data.toHuman()
            : event.data.toString();

          const eventObject = {
            event: ZkVerifyEvents.NewAggregationReceipt,
            data: eventData,
            phase: phase.toJSON ? phase.toJSON() : phase.toString(),
          };

          try {
            currentDomainId = event.data[0]?.toString();
            currentAggregationId = event.data[1]?.toString();

            if (!currentDomainId || !currentAggregationId) {
              throw new Error(
                'Event data is missing required fields: domainId or aggregationId.',
              );
            }
          } catch (error) {
            console.error('Error accessing event data:', error);
            throw error;
          }

          if (domainId === undefined && aggregationId === undefined) {
            callback(eventObject);
            emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
            return;
          }

          if (
            domainId !== undefined &&
            aggregationId === undefined &&
            currentDomainId === domainId
          ) {
            callback(eventObject);
            emitter.emit(ZkVerifyEvents.NewAggregationReceipt, eventObject);
            return;
          }

          if (aggregationId !== undefined) {
            if (currentAggregationId < aggregationId) {
              emitter.emit(
                ZkVerifyEvents.AggregationBeforeExpected,
                eventObject,
              );
              return;
            }

            if (
              currentAggregationId === (parseInt(aggregationId) + 1).toString()
            ) {
              scanLastNBlocksForReceipt(
                api,
                parseInt(domainId!),
                parseInt(aggregationId),
                30,
              )
                .then((found) => {
                  if (!found) {
                    emitter.emit(ZkVerifyEvents.AggregationMissed, eventObject);
                  }
                  unsubscribeFromNewAggregationReceipts(emitter);
                })
                .catch((error) => {
                  emitter.emit(ZkVerifyEvents.ErrorEvent, error);
                  unsubscribeFromNewAggregationReceipts(emitter);
                });
              return;
            }

            if (parseInt(currentAggregationId) > parseInt(aggregationId) + 1) {
              emitter.emit(ZkVerifyEvents.AggregationMissed, eventObject);
              unsubscribeFromNewAggregationReceipts(emitter);
              return;
            }

            if (currentAggregationId === aggregationId) {
              emitter.emit(ZkVerifyEvents.AggregationMatched, eventObject);
              callback(eventObject);
              unsubscribeFromNewAggregationReceipts(emitter);
              return;
            }
          }
        }
      });
    })
    .catch((error) => {
      emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    });

  return emitter;
}

/**
 * Unsubscribes from `NewAggregationReceipt` event tracking.
 *
 * - Emits a `ZkVerifyEvents.Unsubscribe` event before removing all listeners.
 * - Use this to manually stop listening when not auto-unsubscribing on match.
 *
 * @param {EventEmitter} emitter - The EventEmitter instance returned by the subscription.
 */
export function unsubscribeFromNewAggregationReceipts(
  emitter: EventEmitter,
): void {
  emitter.emit(ZkVerifyEvents.Unsubscribe);
  emitter.removeAllListeners();
}

/**
 * Scans the last N blocks for a specific NewAggregationReceipt event
 */
async function scanLastNBlocksForReceipt(
  api: ApiPromise,
  domainId: number,
  aggregationId: number,
  maxBlocks: number,
): Promise<boolean> {
  let currentBlockHash = await api.rpc.chain.getFinalizedHead();
  let currentBlock = await api.rpc.chain.getBlock(currentBlockHash);

  for (let i = 0; i < maxBlocks && currentBlock; i++) {
    const events = (await api.query.system.events.at(
      currentBlockHash,
    )) as unknown as EventRecord[];

    for (const record of events) {
      const { event } = record;

      if (
        event.section === 'aggregate' &&
        event.method === 'NewAggregationReceipt'
      ) {
        const scannedDomainId = Number(event.data[0]);
        const scannedAggregationId = Number(event.data[1]);

        if (
          scannedDomainId === domainId &&
          scannedAggregationId === aggregationId
        ) {
          return true;
        }

        if (
          scannedDomainId === domainId &&
          scannedAggregationId < aggregationId
        ) {
          return false;
        }
      }
    }

    try {
      const previousBlockNumber =
        currentBlock.block.header.number.toNumber() - 1;
      if (previousBlockNumber < 0) break;

      currentBlockHash = await api.rpc.chain.getBlockHash(previousBlockNumber);
      currentBlock = await api.rpc.chain.getBlock(currentBlockHash);
    } catch {
      break;
    }
  }

  return false;
}
