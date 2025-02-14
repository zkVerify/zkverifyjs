import 'dotenv/config';
import { ApiPromise } from '@polkadot/api';
import { EventEmitter } from 'events';
import { AttestationEvent, ProofProcessor } from '../../types';
import { ZkVerifyEvents } from '../../enums';
import { proofConfigurations, ProofType } from '../../config';
import { subscribeToNewAttestations } from '../../api/attestation';
import { decodeDispatchError } from '../transactions/errors';
import { DispatchError } from '@polkadot/types/interfaces';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../../api/connection/types';

/**
 * Waits for a specific `NewAttestation` event and returns the associated data.
 *
 * @param {ApiPromise} api - The Polkadot.js API instance.
 * @param {number | undefined} attestationId - The attestation ID to wait for.
 * @param {EventEmitter} emitter - The EventEmitter instance for emitting events.
 *
 * @returns {Promise<AttestationEvent>} Resolves with the attestation event data if confirmed, or rejects with an error.
 *
 * @throws {Error} If the attestation ID is undefined or an error occurs during event subscription.
 *
 * @emits ZkVerifyEvents.AttestationConfirmed - When the specified attestation is confirmed.
 * @emits ZkVerifyEvents.AttestationMissed - If a later attestation ID is received.
 * @emits ZkVerifyEvents.BeforeExpected - If the attestation ID from the event is less than expected.
 * @emits ZkVerifyEvents.ErrorEvent - If an error occurs.
 */
export async function waitForNewAttestationEvent(
  api: ApiPromise,
  attestationId: number | undefined,
  emitter: EventEmitter,
): Promise<AttestationEvent> {
  if (!attestationId) {
    const error = new Error('No attestation ID found.');
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    throw error;
  }

  return new Promise<AttestationEvent>((resolve, reject) => {
    const internalEmitter = subscribeToNewAttestations(
      api,
      () => {},
      attestationId,
    );

    internalEmitter.on(ZkVerifyEvents.AttestationConfirmed, (event) => {
      emitter.emit(ZkVerifyEvents.AttestationConfirmed, event);
      resolve(event);
    });

    internalEmitter.on(ZkVerifyEvents.AttestationMissed, (event) => {
      emitter.emit(ZkVerifyEvents.AttestationMissed, event);
      reject(new Error(`Missed the attestation ID ${attestationId}.`));
    });

    internalEmitter.on(ZkVerifyEvents.AttestationBeforeExpected, (event) => {
      emitter.emit(ZkVerifyEvents.AttestationBeforeExpected, event);
    });

    internalEmitter.on(ZkVerifyEvents.ErrorEvent, (error) => {
      emitter.emit(ZkVerifyEvents.ErrorEvent, error);
      reject(error);
    });
  });
}

/**
 * Waits for the zkVerify node to sync.
 * @param api - The ApiPromise instance.
 * @returns A promise that resolves when the node is synced.
 */
export async function waitForNodeToSync(api: ApiPromise): Promise<void> {
  let isSyncing = true;

  while (isSyncing) {
    const health = await api.rpc.system.health();
    isSyncing = health.isSyncing.isTrue;
    if (isSyncing) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export function getProofProcessor(proofType: ProofType): ProofProcessor {
  const config = proofConfigurations[proofType];
  if (!config) {
    throw new Error(`No config found for Proof Processor: ${proofType}`);
  }
  return config.processor;
}

export function getProofPallet(proofType: ProofType): string {
  const config = proofConfigurations[proofType as ProofType];
  if (!config) {
    throw new Error(`No config found for Proof Pallet: ${proofType}`);
  }
  return config.pallet;
}

export function checkReadOnly(
  connection: AccountConnection | WalletConnection | EstablishedConnection,
): void {
  if (!('account' in connection) && !('injector' in connection)) {
    throw new Error(
      'This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.',
    );
  }
}

/**
 * Interprets a dry run response and returns whether it was successful and any error message.
 * @param api - The Polkadot.js API instance.
 * @param resultHex - The hex-encoded response from a dry run.
 * @returns An object containing `success` (boolean) and `message` (string).
 */
export const interpretDryRunResponse = async (
  api: ApiPromise,
  resultHex: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const responseBytes = Uint8Array.from(
      Buffer.from(resultHex.replace('0x', ''), 'hex'),
    );

    if (responseBytes[0] === 0x00 && responseBytes[1] === 0x00) {
      return { success: true, message: 'Optimistic Verification Successful!' };
    }

    if (responseBytes[0] === 0x00 && responseBytes[1] === 0x01) {
      const dispatchError = api.registry.createType(
        'DispatchError',
        responseBytes.slice(2),
      ) as DispatchError;
      const errorMessage = decodeDispatchError(api, dispatchError);
      return { success: false, message: errorMessage };
    }

    return {
      success: false,
      message: `Unexpected response format: ${resultHex}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to interpret dry run result: ${error}`,
    };
  }
};

/**
 * Validates the version of the proof based on the configuration.
 * @param proofType - The proof type to validate.
 * @param version - The version to validate.
 * @throws Error if the version is not supported or not provided when required.
 */
export function validateProofVersion(
  proofType: ProofType,
  version?: string,
): void {
  const config = proofConfigurations[proofType];

  if (config.supportedVersions.length > 0) {
    if (!version) {
      throw new Error(`Version is required for proof type: ${proofType}`);
    }

    if (!config.supportedVersions.includes(version)) {
      throw new Error(
        `Invalid version '${version}' for proof type: ${proofType}. Supported versions: ${config.supportedVersions.join(', ')}`,
      );
    }
  }
}

/**
 * Binds all methods from the source object to the target object,
 * preserving the original `this` context.
 *
 * Throws an error if a method with the same name already exists on the target.
 *
 * @param target - The object to bind methods to.
 * @param source - The object containing the methods to bind.
 *
 * @throws {Error} If a method with the same name already exists on the target.
 */
export function bindMethods<T extends object>(target: T, source: object): void {
  const propertyNames = Object.getOwnPropertyNames(
    Object.getPrototypeOf(source),
  );

  for (const name of propertyNames) {
    const method = (source as Record<string, unknown>)[name];

    if (typeof method === 'function' && name !== 'constructor') {
      if (name in target) {
        throw new Error(
          `❌ Method collision detected: "${name}". Binding aborted.`,
        );
      }

      (target as Record<string, unknown>)[name] = method.bind(source);
    }
  }
}
