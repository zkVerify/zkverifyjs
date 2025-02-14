import {
  subscribeToNewAttestations,
  unsubscribeFromNewAttestations,
} from '../../../api/attestation';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection';
import { AttestationEvent } from '../../../types';

export class EventManager {
  private connectionManager: ConnectionManager;
  private emitter?: EventEmitter;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Subscribes to NewAttestation events.
   * @param {Function} callback - The function to call with the event data when a NewAttestation event occurs.
   * @param {string} [attestationId] - Optional attestation ID to filter events by and unsubscribe after.
   */
  subscribe(
    callback: (data: AttestationEvent) => void,
    attestationId?: number,
  ): EventEmitter {
    this.emitter = subscribeToNewAttestations(
      this.connectionManager.api,
      callback,
      attestationId,
    );
    return this.emitter;
  }

  /**
   * Unsubscribes from NewAttestation events.
   * Emits the 'unsubscribe' event which causes removeAllListeners() on the newAttestationEmitter
   */
  unsubscribe(): void {
    if (this.emitter) {
      unsubscribeFromNewAttestations(this.emitter);
    }
  }
}
