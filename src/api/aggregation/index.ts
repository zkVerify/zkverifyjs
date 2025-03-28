import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { EventEmitter } from 'events';
import { NewAggregationReceipt } from '../../types';
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
 * @param {(data: NewAggregationReceipt) => void} callback - Function to call with the receipt data.
 * @param options
 * @param emitter
 * @returns {EventEmitter} EventEmitter for listening to emitted events and unsubscribing.
 */
export function subscribeToNewAggregationReceipts(
  api: ApiPromise,
  callback: (data: NewAggregationReceipt) => void,
  options: NewAggregationEventSubscriptionOptions = undefined,
  emitter: EventEmitter,
): EventEmitter {
  let domainId: number | undefined = undefined;
  let aggregationId: number | undefined = undefined;

  if (options) {
    domainId = options.domainId;
    if ('aggregationId' in options) {
      aggregationId = options.aggregationId;

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
        const { event } = record;

        if (
          event.section === 'aggregate' &&
          event.method === 'NewAggregationReceipt'
        ) {
          const currentDomainId = Number(event.data[0]);
          const currentAggregationId = Number(event.data[1]);
          const receipt = event.data[2].toString();

          if (domainId === undefined && aggregationId === undefined) {
            callback({
              domainId: currentDomainId,
              aggregationId: currentAggregationId,
              receipt,
            });
            return;
          }

          if (
            domainId !== undefined &&
            aggregationId === undefined &&
            currentDomainId === domainId
          ) {
            callback({
              domainId: currentDomainId,
              aggregationId: currentAggregationId,
              receipt,
            });
            return;
          }

          if (aggregationId !== undefined) {
            if (currentAggregationId < aggregationId) {
              emitter.emit(ZkVerifyEvents.AggregationBeforeExpected, {
                expectedId: aggregationId,
                receivedId: currentAggregationId,
                event: record.event,
              });
              return;
            }

            if (currentAggregationId === aggregationId + 1) {
              scanLastNBlocksForReceipt(api, domainId!, aggregationId, 30)
                .then((found) => {
                  if (!found) {
                    emitter.emit(ZkVerifyEvents.AggregationMissed, {
                      expectedId: aggregationId,
                      receivedId: currentAggregationId,
                      event: record.event,
                    });
                  }
                  unsubscribeFromNewAggregationReceipts(emitter);
                })
                .catch((error) => {
                  emitter.emit(ZkVerifyEvents.ErrorEvent, error);
                  unsubscribeFromNewAggregationReceipts(emitter);
                });
              return;
            }

            if (currentAggregationId > aggregationId + 1) {
              emitter.emit(ZkVerifyEvents.AggregationMissed, {
                expectedId: aggregationId,
                receivedId: currentAggregationId,
                event: record.event,
              });
              unsubscribeFromNewAggregationReceipts(emitter);
              return;
            }

            if (currentAggregationId === aggregationId) {
              const receiptEvent: NewAggregationReceipt = {
                domainId: currentDomainId,
                aggregationId: currentAggregationId,
                receipt,
              };

              emitter.emit(ZkVerifyEvents.AggregationMatched, receiptEvent);
              callback(receiptEvent);
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
