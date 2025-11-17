import { ApiPromise } from '@polkadot/api';
import { EventEmitter } from 'events';
import {
  Delivery,
  DomainOptions,
  OptimisticVerifyResult,
  ProofProcessor,
  TransactionValidityError,
} from '../../types';
import { Destination } from '../../enums';
import {
  Groth16Config,
  Plonky2Config,
  ProofConfig,
  proofConfigurations,
  ProofOptions,
  ProofType,
  Risc0Config,
  UltraplonkConfig,
  UltrahonkConfig,
} from '../../config';
import { decodeDispatchError } from '../transactions/errors';
import { DispatchError, Extrinsic } from '@polkadot/types/interfaces';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../../api/connection/types';

export * from './runtimeVersion';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';

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

let cachedVerifierPallets: Set<string> | null = null;

function getVerifierPallets(): Set<string> {
  if (cachedVerifierPallets) return cachedVerifierPallets;
  const entries = Object.values(proofConfigurations ?? {}) as ProofConfig[];
  cachedVerifierPallets = new Set(
    entries.map((cfg) => cfg.pallet).filter(Boolean),
  );
  return cachedVerifierPallets;
}

/**
 * Interprets a dry run response and returns whether it was successful and any error message.
 * @param api - The Polkadot.js API instance.
 * @param resultHex - The hex-encoded response from a dry run.
 * @param proofType
 * @returns An object containing `success` (boolean) and `message` (string).
 */
export async function interpretDryRunResponse(
  api: ApiPromise,
  resultHex: string,
  proofType?: ProofType,
): Promise<OptimisticVerifyResult> {
  const responseBytes = Uint8Array.from(
    Buffer.from(resultHex.replace(/^0x/, ''), 'hex'),
  );

  if (responseBytes.length === 0) {
    return {
      success: false,
      type: 'unknown_error',
      message: 'Empty dryRun response',
      verificationError: false,
    };
  }

  if (responseBytes[0] === 0x01) {
    let validityError: TransactionValidityError | null;

    try {
      validityError = api.registry.createType(
        'TransactionValidityError',
        responseBytes.slice(1),
      ) as unknown as TransactionValidityError;
    } catch {
      try {
        validityError = api.registry.createType(
          'SpRuntimeTransactionValidityError',
          responseBytes.slice(1),
        ) as unknown as TransactionValidityError;
      } catch {
        validityError = null;
      }
    }

    if (validityError?.isInvalid) {
      const code = `InvalidTransaction.${validityError?.asInvalid.type}`;
      return {
        success: false,
        type: 'validity_error',
        code,
        message: code,
        verificationError: false,
      };
    }
    if (validityError?.isUnknown) {
      const code = `UnknownTransaction.${validityError?.asUnknown.type}`;
      return {
        success: false,
        type: 'validity_error',
        code,
        message: code,
        verificationError: false,
      };
    }
    return {
      success: false,
      type: 'validity_error',
      message: validityError?.toString() ?? 'TransactionValidityError',
      verificationError: false,
    };
  }

  if (responseBytes[0] === 0x00 && responseBytes.length >= 2) {
    if (responseBytes[1] === 0x00) {
      return {
        success: true,
        type: 'ok',
        message: 'Optimistic Verification Successful!',
      };
    }

    if (responseBytes[1] === 0x01) {
      try {
        const dispatchErrorCodec = api.registry.createType(
          'DispatchError',
          responseBytes.slice(2),
        ) as DispatchError;

        const { code, message, section } = decodeDispatchError(
          api,
          dispatchErrorCodec,
        );

        const expectedPallet = proofType
          ? proofConfigurations?.[proofType]?.pallet
          : undefined;

        const isVerifier =
          !!section &&
          (section === expectedPallet || getVerifierPallets().has(section));

        return {
          success: false,
          type: 'dispatch_error',
          code,
          message,
          verificationError: isVerifier,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        return {
          success: false,
          type: 'exception',
          message,
          verificationError: false,
        };
      }
    }
  }

  return {
    success: false,
    type: 'unknown_error',
    message: `Unexpected response format: ${resultHex}`,
    verificationError: false,
  };
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
 * Extracts a human-readable error message from various error types.
 *
 * @param err - The error object to extract a message from.
 * @returns A string message describing the error.
 */
export const extractErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const maybeError = err as Record<string, unknown>;
    if (typeof maybeError.error === 'string') {
      return maybeError.error;
    }
    return JSON.stringify(err);
  }

  return String(err);
};

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

/**
 * Type guard for Ultraplonk Config
 */
export function isUltraplonkConfig(
  options: ProofOptions,
): options is ProofOptions & { config: UltraplonkConfig } {
  return (
    options.proofType === ProofType.ultraplonk &&
    options.config !== undefined &&
    (options.config as UltraplonkConfig).numberOfPublicInputs !== undefined
  );
}

/**
 * Type guard for Ultrahonk Config
 */
export function isUltrahonkConfig(
  options: ProofOptions,
): options is ProofOptions & { config: UltrahonkConfig } {
  return (
    options.proofType === ProofType.ultrahonk &&
    options.config !== undefined &&
    (options.config as UltrahonkConfig).variant !== undefined
  );
}

// ADD_NEW_PROOF_TYPE if it has a config options object

/**
 * Type guard to check if an object is a SubmittableExtrinsic<'promise'>.
 *
 * A SubmittableExtrinsic is identified by the presence of a `signAsync` method.
 *
 * @param obj - The object to evaluate.
 * @returns True if the object is a SubmittableExtrinsic, otherwise false.
 */
function isSubmittableExtrinsic(
  obj: unknown,
): obj is SubmittableExtrinsic<'promise'> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'signAsync' in obj &&
    typeof (obj as { signAsync: unknown }).signAsync === 'function'
  );
}

/**
 * Ensures the provided extrinsic is a SubmittableExtrinsic.
 * Converts a raw Extrinsic to Submittable if needed using the given API instance.
 *
 * @param extrinsic - A SubmittableExtrinsic or raw Extrinsic.
 * @param api - An instance of ApiPromise used to convert the extrinsic.
 * @returns A SubmittableExtrinsic<'promise'> ready to be signed and submitted.
 */
export function toSubmittableExtrinsic(
  extrinsic: SubmittableExtrinsic<'promise'> | Extrinsic,
  api: ApiPromise,
): SubmittableExtrinsic<'promise'> {
  if (isSubmittableExtrinsic(extrinsic)) {
    return extrinsic;
  }

  const call = api.createType('Call', extrinsic.method);
  return api.tx(call);
}
