import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { EventEmitter } from 'events';
import { AttestationEvent } from '../../types';
import { ZkVerifyEvents } from '../../enums';

/**
 * Subscribes to NewAttestation events on the chain and triggers the provided callback as they occur.
 * Optionally filters the events by attestationId.
 * If attestationId is specified, the subscription will automatically end after the event is received.
 *
 * @param {ApiPromise} api - The Polkadot.js API instance.
 * @param {Function} callback - The callback function to call with the event data when a NewAttestation event occurs.
 * @param {number} [attestationId] - Optional attestation ID to filter events by and subsequently unsubscribe.
 * @returns {EventEmitter} An EventEmitter that handles the subscription.
 */
export function subscribeToNewAttestations(
  api: ApiPromise,
  callback: (data: AttestationEvent) => void,
  attestationId?: number,
): EventEmitter {
  const emitter = new EventEmitter();

  api.query.system
    .events((events: EventRecord[]) => {
      events.forEach((record: EventRecord) => {
        const { event } = record;

        if (event.section === 'poe' && event.method === 'NewAttestation') {
          const currentAttestationId = Number(event.data[0]);

          if (attestationId) {
            if (currentAttestationId < attestationId) {
              emitter.emit(ZkVerifyEvents.AttestationBeforeExpected, {
                expectedId: attestationId,
                receivedId: currentAttestationId,
                event: record.event,
              });

              return;
            }
            if (currentAttestationId === attestationId + 1) {
              scanLastNBlocksForAttestation(api, attestationId, 20)
                .then((found) => {
                  if (!found) {
                    emitter.emit(ZkVerifyEvents.AttestationMissed, {
                      expectedId: attestationId,
                      receivedId: currentAttestationId,
                      event: record.event,
                    });
                  }
                  unsubscribeFromNewAttestations(emitter);
                })
                .catch((error) => {
                  emitter.emit(ZkVerifyEvents.ErrorEvent, error);
                  unsubscribeFromNewAttestations(emitter);
                });

              return;
            }
            if (currentAttestationId > attestationId + 1) {
              emitter.emit(ZkVerifyEvents.AttestationMissed, {
                expectedId: attestationId,
                receivedId: currentAttestationId,
                event: record.event,
              });

              unsubscribeFromNewAttestations(emitter);
              return;
            }
            if (currentAttestationId === attestationId) {
              const attestationEvent: AttestationEvent = {
                id: currentAttestationId,
                attestation: event.data[1].toString(),
              };

              emitter.emit(
                ZkVerifyEvents.AttestationConfirmed,
                attestationEvent,
              );
              callback(attestationEvent);

              unsubscribeFromNewAttestations(emitter);
              return;
            }
          } else {
            const attestationEvent: AttestationEvent = {
              id: currentAttestationId,
              attestation: event.data[1].toString(),
            };
            callback(attestationEvent);
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
 * Unsubscribes from the current NewAttestation events subscription.
 * This stops any further events from being emitted.
 *
 * @param {EventEmitter} emitter - The EventEmitter to unsubscribe.
 */
export function unsubscribeFromNewAttestations(emitter: EventEmitter): void {
  emitter.emit(ZkVerifyEvents.Unsubscribe);
  emitter.removeAllListeners();
}

/**
 * Scans the last N blocks for a specific attestation event.
 *
 * @param {ApiPromise} api - The Polkadot.js API instance.
 * @param {number} attestationId - The attestation ID to search for.
 * @param {number} maxBlocks - The maximum number of blocks to scan.
 * @returns {Promise<boolean>} - Resolves to `true` if the attestation is found, otherwise `false`.
 */
async function scanLastNBlocksForAttestation(
  api: ApiPromise,
  attestationId: number,
  maxBlocks: number,
): Promise<boolean> {
  let currentBlockHash = await api.rpc.chain.getFinalizedHead();
  let currentBlock = await api.rpc.chain.getBlock(currentBlockHash);

  for (let i = 0; i < maxBlocks && currentBlock; i++) {
    const events = (await api.query.system.events.at(
      currentBlockHash,
    )) as unknown as EventRecord[];

    events.forEach((record: EventRecord) => {
      const { event } = record;

      if (event.section === 'poe' && event.method === 'NewAttestation') {
        const scannedAttestationId = Number(event.data[0]);

        if (scannedAttestationId < attestationId) {
          return false;
        }
        if (scannedAttestationId === attestationId) {
          return true;
        }
      }
    });

    try {
      const previousBlockNumber =
        currentBlock.block.header.number.toNumber() - 1;
      if (previousBlockNumber < 0) {
        break;
      }

      currentBlockHash = await api.rpc.chain.getBlockHash(previousBlockNumber);
      currentBlock = await api.rpc.chain.getBlock(currentBlockHash);
    } catch {
      break;
    }
  }

  return false;
}
