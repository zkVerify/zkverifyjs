import 'dotenv/config';
import { ApiPromise } from '@polkadot/api';
import { EventEmitter } from 'events';
import { Delivery, DomainOptions, ProofProcessor } from '../../types';
import { Destination } from '../../enums';
import {
  Groth16Config,
  Plonky2Config,
  proofConfigurations,
  ProofOptions,
  ProofType,
  Risc0Config,
} from '../../config';
import { decodeDispatchError } from '../transactions/errors';
import { DispatchError } from '@polkadot/types/interfaces';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../../api/connection/types';
import { KeyringPair } from '@polkadot/keyring/types';

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
  if (
    (!('accounts' in connection) ||
      ('accounts' in connection && connection.accounts.size === 0)) &&
    !('injector' in connection)
  ) {
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

/**
 * Retrieves the selected account from the connection based on the provided account address.
 * If no account address is provided, it defaults to the first available account.
 *
 * @param {AccountConnection} connection - The connection containing account information.
 * @param {string | undefined} accountAddress - The optional account address to retrieve.
 * @returns {KeyringPair} - The selected account.
 * @throws {Error} If the account is not found.
 */
export const getSelectedAccount = (
  connection: AccountConnection,
  accountAddress?: string,
): KeyringPair => {
  let selectedAccount: KeyringPair | undefined;

  if (accountAddress) {
    selectedAccount = connection.accounts.get(accountAddress);
  } else {
    selectedAccount = Array.from(connection.accounts.values())[0];
  }

  if (!selectedAccount) {
    throw new Error(`Account ${accountAddress ?? ''} not found in session.`);
  }

  return selectedAccount;
};

/**
 * Retrieves the selected `KeyringPair` from the given connection if it is an `AccountConnection`.
 *
 * - If the connection has local `accounts` (i.e., it's an `AccountConnection`), it uses the provided `accountAddress`
 *   to select the appropriate account via `getSelectedAccount`.
 * - If the connection is a `WalletConnection`, returns `undefined`.
 *
 * @param {AccountConnection | WalletConnection} connection - The connection object which may contain accounts.
 * @param {string} [accountAddress] - Optional address of the account to select.
 * @returns {KeyringPair | undefined} - The selected `KeyringPair` if available, otherwise `undefined`.
 */
export function getKeyringAccountIfAvailable(
  connection: AccountConnection | WalletConnection,
  accountAddress?: string,
): KeyringPair | undefined {
  return 'accounts' in connection
    ? getSelectedAccount(connection, accountAddress)
    : undefined;
}

/**
 * Converts a `DeliveryInput` into a properly formatted `Delivery` object.
 * Supports either a `None` variant or a `Hyperbridge` delivery configuration.
 *
 * @returns A `Delivery` object formatted for on-chain use.
 * @throws {Error} If required fields for Hyperbridge delivery are missing or invalid.
 * @param options
 */
export function normalizeDeliveryFromOptions(options: DomainOptions): Delivery {
  if (options.destination === Destination.None) {
    return { None: null };
  }

  const { deliveryInput } = options;

  return {
    destination: {
      Hyperbridge: {
        destinationChain: deliveryInput.destinationChain,
        destination_module: deliveryInput.destination_module,
        timeout: deliveryInput.timeout,
      },
    },
    price: deliveryInput.price,
  };
}

/**
 * Safe wrapper for emitting events without crashing.
 */
export const safeEmit = (
  emitter: EventEmitter,
  event: string,
  data: unknown,
) => {
  try {
    emitter.emit(event, data);
  } catch (error) {
    console.debug(`Failed to emit event ${event}:`, error);
  }
};

/**
 * Type guard for Groth16Config
 */
export function isGroth16Config(
  options: ProofOptions,
): options is ProofOptions & { config: Groth16Config } {
  return (
    options.proofType === ProofType.groth16 &&
    options.config !== undefined &&
    (options.config as Groth16Config).library !== undefined &&
    (options.config as Groth16Config).curve !== undefined
  );
}

/**
 * Type guard for Plonky2Config
 */
export function isPlonky2Config(
  options: ProofOptions,
): options is ProofOptions & { config: Plonky2Config } {
  return (
    options.proofType === ProofType.plonky2 &&
    options.config !== undefined &&
    (options.config as Plonky2Config).hashFunction !== undefined
  );
}

/**
 * Type guard for Risc0Config
 */
export function isRisc0Config(
  options: ProofOptions,
): options is ProofOptions & { config: Risc0Config } {
  return (
    options.proofType === ProofType.risc0 &&
    options.config !== undefined &&
    (options.config as Risc0Config).version !== undefined
  );
}
