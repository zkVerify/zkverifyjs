import {
  BatchOptimisticProofMethodMap,
  BatchProofMethodMap,
  OptimisticProofMethodMap,
  OptimisticVerifyOptions,
  ProofMethodMap,
} from '../../types';
import { verify } from '../../../api/verify';
import { optimisticVerify } from '../../../api/optimisticVerify';
import { batchVerify } from '../../../api/batchVerify';
import { batchOptimisticVerify } from '../../../api/batchOptimisticVerify';
import { AllProofConfigs, ProofOptions, ProofType } from '../../../config';
import { VerificationBuilder } from '../../builders/verify';
import { OptimisticVerificationBuilder } from '../../builders/optimisticVerify';
import { validateProofTypeOptions } from '../../validator';
import { VerifyInput } from '../../../api/verify/types';
import { EventEmitter } from 'events';
import {
  BatchVerifyTransactionInfo,
  OptimisticVerifyResult,
  VerifyTransactionInfo,
} from '../../../types';
import { checkReadOnly } from '../../../utils/helpers';
import { ConnectionManager } from '../connection';
import {
  AccountConnection,
  WalletConnection,
} from '../../../api/connection/types';
import { BatchVerificationBuilder } from '../../builders/batchVerify';
import { BatchOptimisticVerificationBuilder } from '../../builders/batchOptimisticVerify';

export class VerificationManager {
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Creates a builder map for different proof types that can be used for verification.
   * Each proof type returns a `VerificationBuilder` that allows you to chain methods for setting options
   * and finally executing the verification process.
   *
   * @param {string} [accountAddress] - The address of the account performing the verification.
   * @returns {ProofMethodMap} A map of proof types to their corresponding builder methods.
   */
  verify(accountAddress?: string): ProofMethodMap {
    const builderMethods: Partial<ProofMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (proofConfig?: AllProofConfigs | null) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              config: proofConfig ?? undefined,
            };

            validateProofTypeOptions(proofOptions);

            return this.createVerifyBuilder(proofOptions, accountAddress);
          },
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }

    return builderMethods as ProofMethodMap;
  }

  /**
   * Creates a builder map for different proof types that can be used for optimistic verification.
   * Each proof type returns an `OptimisticVerificationBuilder` that allows you to chain methods
   * and finally execute the optimistic verification process.
   *
   * @returns {OptimisticProofMethodMap} A map of proof types to their corresponding builder methods.
   */
  optimisticVerify(accountAddress?: string): OptimisticProofMethodMap {
    const builderMethods: Partial<OptimisticProofMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (proofConfig?: AllProofConfigs | null) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              config: proofConfig ?? undefined,
            };

            validateProofTypeOptions(proofOptions);

            return this.createOptimisticVerifyBuilder(
              proofOptions,
              accountAddress,
            );
          },
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }

    return builderMethods as OptimisticProofMethodMap;
  }

  /**
   * Creates a builder map for different proof types that can be used for **batch verification**.
   * Each proof type returns a `BatchVerificationBuilder` allowing you to set options
   * and then submit multiple proofs in a single `batchAll` transaction.
   *
   * @param {string} [accountAddress] - The account address performing the batch verification.
   * @returns {BatchProofMethodMap} A map of proof types to their batch verification builder methods.
   */
  batchVerify(accountAddress?: string): BatchProofMethodMap {
    const builderMethods: Partial<BatchProofMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (proofConfig?: AllProofConfigs | null) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              config: proofConfig ?? undefined,
            };

            validateProofTypeOptions(proofOptions);

            return this.createBatchVerifyBuilder(proofOptions, accountAddress);
          },
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }

    return builderMethods as BatchProofMethodMap;
  }

  /**
   * Creates a builder map for different proof types that can be used for **optimistic batch verification**.
   * Each proof type returns a `BatchOptimisticVerificationBuilder` that builds and dry-runs a `batchAll` transaction
   * to ensure all proofs would pass without submitting to the chain.
   *
   * @returns {BatchOptimisticProofMethodMap} A map of proof types to their optimistic batch verification builders.
   */
  batchOptimisticVerify(
    accountAddress?: string,
  ): BatchOptimisticProofMethodMap {
    const builderMethods: Partial<BatchOptimisticProofMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (proofConfig?: AllProofConfigs | null) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              config: proofConfig ?? undefined,
            };

            validateProofTypeOptions(proofOptions);

            return this.createBatchOptimisticVerifyBuilder(
              proofOptions,
              accountAddress,
            );
          },
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }

    return builderMethods as BatchOptimisticProofMethodMap;
  }

  /**
   * Factory method to create a `VerificationBuilder` for the given proof type.
   * The builder allows for chaining options and executing the verification process.
   *
   * @param {AllProofConfigs} proofOptions - The proof options object containing the proof type and its specific options.
   *   - Must include a valid `proofType` and associated options depending on the proof type
   *
   * @param {string} [accountAddress] - The account to use for verification.
   *   - If a `string`, it represents the account address.
   *   - If `undefined`, the first available account is used by default.
   *
   * @returns {VerificationBuilder} A new instance of `VerificationBuilder` configured with the provided proof options and account.
   *
   * @throws {Error} If the provided proof options are invalid or incomplete.
   * @private
   */
  private createVerifyBuilder(
    proofOptions: ProofOptions,
    accountAddress?: string,
  ): VerificationBuilder {
    return new VerificationBuilder(
      this.executeVerify.bind(this),
      proofOptions,
      accountAddress,
    );
  }

  /**
   * Factory method to create an `OptimisticVerificationBuilder` for the given proof type.
   * This builder allows for configuring and executing the optimistic verification process.
   *
   * @param {AllProofConfigs} proofOptions - The proof options object containing the proof type and its specific options.
   *   - Must include a valid `proofType` and associated options depending on the proof type
   *
   * @param {string} [accountAddress] - Optional account address to sign and submit the transaction.
   * @returns {OptimisticVerificationBuilder} A new instance of `OptimisticVerificationBuilder` configured with the provided proof options.
   *
   * @throws {Error} If the provided proof options are invalid or incomplete.
   * @private
   */
  private createOptimisticVerifyBuilder(
    proofOptions: ProofOptions,
    accountAddress?: string,
  ): OptimisticVerificationBuilder {
    return new OptimisticVerificationBuilder(
      this.executeOptimisticVerify.bind(this),
      proofOptions,
      accountAddress,
    );
  }

  /**
   * Factory method to create a `BatchVerificationBuilder` for the given proof type.
   * This builder enables chaining configuration methods and executing a batch of on-chain verifications
   * using a single `batchAll` transaction.
   *
   * @param {ProofOptions} proofOptions - Configuration for the proof type and related parameters.
   * @param {string} [accountAddress] - Optional account address to sign and submit the transaction.
   * @returns {BatchVerificationBuilder} A builder for executing batch verification.
   *
   * @throws {Error} If the provided proof options are invalid.
   * @private
   */
  private createBatchVerifyBuilder(
    proofOptions: ProofOptions,
    accountAddress?: string,
  ): BatchVerificationBuilder {
    return new BatchVerificationBuilder(
      this.executeBatchVerify.bind(this),
      proofOptions,
      accountAddress,
    );
  }

  /**
   * Factory method to create a `BatchVerificationBuilder` for the given proof type.
   * This builder enables chaining configuration methods and executing a batch of on-chain verifications
   * using a single `batchAll` transaction.
   *
   * @param {ProofOptions} proofOptions - Configuration for the proof type and related parameters.
   * @param {string} [accountAddress] - Optional account address to sign and submit the transaction.
   * @returns {BatchVerificationBuilder} A builder for executing batch verification.
   *
   * @throws {Error} If the provided proof options are invalid.
   * @private
   */
  private createBatchOptimisticVerifyBuilder(
    proofOptions: ProofOptions,
    accountAddress?: string,
  ): BatchOptimisticVerificationBuilder {
    return new BatchOptimisticVerificationBuilder(
      this.executeBatchOptimisticVerify.bind(this),
      proofOptions,
      accountAddress,
    );
  }

  /**
   * Executes the verification process with the provided proof options and proof data or pre-built extrinsic.
   * This method is intended to be called by the `VerificationBuilder`.
   *
   * @param {OptimisticVerifyOptions} options - The options for the verification process, including:
   *   - `proofOptions` {AllProofOptions}: Contains the proof type and associated options depending on the type.
   *   - `accountAddress` {string} [optional]: The account address to use for the verification.
   *   - `nonce` {number} [optional]: The nonce for the transaction, if applicable.
   *   - `registeredVk` {boolean} [optional]: Whether to use a registered verification key.
   *   - `domainId` {number} [optional]: The domain ID for domain-specific operations.
   *   - `atBlock` {number | string} [optional]: The block at which to run the optimistic verification.
   *
   * @param {VerifyInput} input - The verification input, which must be one of the following:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   - Ensure only one of these options is provided within the `VerifyInput`.
   *
   * @returns {Promise<{events: EventEmitter, transactionResult: Promise<VerifyTransactionInfo>}>}
   *   A promise that resolves with an object containing:
   *   - `events`: An `EventEmitter` instance for real-time verification events.
   *   - `transactionResult`: A promise that resolves to the final transaction information once verification is complete.
   *
   * @throws {Error} If the verification fails or the proof options are invalid.
   * @private
   */
  private async executeVerify(
    options: OptimisticVerifyOptions,
    input: VerifyInput,
  ): Promise<{
    events: EventEmitter;
    transactionResult: Promise<VerifyTransactionInfo>;
  }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    const events = new EventEmitter();
    const transactionResult = verify(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      options,
      events,
      input,
    );

    return { events, transactionResult };
  }

  /**
   * Executes the optimistic verification process using the provided proof options and input.
   * This method is intended to be called by the `OptimisticVerificationBuilder`.
   *
   * @param {OptimisticVerifyOptions} options - The options for the verification process, including:
   *   - `proofOptions` {AllProofOptions}: Contains the proof type and associated options depending on the type.
   *   - `accountAddress` {string} [optional]: The account address to use for the verification.
   *   - `nonce` {number} [optional]: The nonce for the transaction, if applicable.
   *   - `registeredVk` {boolean} [optional]: Whether to use a registered verification key.
   *   - `domainId` {number} [optional]: The domain ID for domain-specific operations.
   *   - `atBlock` {number | string} [optional]: The block at which to run the optimistic verification.
   * @param {VerifyInput} input - The verification input, which must be one of the following:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   - Ensure only one of these options is provided within the `VerifyInput`.
   *
   * @returns {Promise<OptimisticVerifyResult>}
   *   A promise that resolves to an object containing:
   *   - `success`: A boolean indicating whether the optimistic verification was successful.
   *   - `message`: A message providing additional details about the verification result.
   *
   * @throws {Error} If the session is in read-only mode.
   * @throws {Error} If not connected to a custom network.
   * @private
   */
  private async executeOptimisticVerify(
    options: OptimisticVerifyOptions,
    input: VerifyInput,
  ): Promise<OptimisticVerifyResult> {
    checkReadOnly(this.connectionManager.connectionDetails);

    if (!this.connectionManager.customNetwork) {
      throw new Error(
        'Optimistic verification is only supported on custom networks.',
      );
    }

    return optimisticVerify(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      options,
      input,
    );
  }

  /**
   * Executes a full on-chain batch verification of multiple proofs.
   * Internally constructs a `batchAll` extrinsic and listens for success or error events.
   *
   * @param {OptimisticVerifyOptions} options - The options for the verification process, including:
   *   - `proofOptions` {AllProofOptions}: Contains the proof type and associated options depending on the type.
   *   - `accountAddress` {string} [optional]: The account address to use for the verification.
   *   - `nonce` {number} [optional]: The nonce for the transaction, if applicable.
   *   - `registeredVk` {boolean} [optional]: Whether to use a registered verification key.
   *   - `domainId` {number} [optional]: The domain ID for domain-specific operations.
   *   - `atBlock` {number | string} [optional]: The block at which to run the optimistic verification.
   * @param {VerifyInput[]} input - An array of verification input, which must be one of the following:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   - Ensure only one of these options is provided within the `VerifyInput`.
   * @returns {Promise<{events: EventEmitter, transactionResult: Promise<BatchVerifyTransactionInfo>}>}
   *   A promise resolving to:
   *   - `events`: An EventEmitter for lifecycle events (broadcast, includedInBlock, finalized, etc).
   *   - `transactionResult`: The final batch verification result after on-chain execution.
   *
   * @throws {Error} If verification is called while in read-only mode.
   */
  private async executeBatchVerify(
    options: OptimisticVerifyOptions,
    input: VerifyInput[],
  ): Promise<{
    events: EventEmitter;
    transactionResult: Promise<BatchVerifyTransactionInfo>;
  }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    const events = new EventEmitter();
    const transactionResult = batchVerify(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      options,
      events,
      input,
    );

    return { events, transactionResult };
  }

  /**
   * Executes a dry-run of a batch verification to simulate success or failure without submitting.
   * This method wraps `api.rpc.system.dryRun` around the `batchAll` extrinsic built from the proof list.
   *
   * @param {OptimisticVerifyOptions} options - The options for the verification process, including:
   *   - `proofOptions` {AllProofOptions}: Contains the proof type and associated options depending on the type.
   *   - `accountAddress` {string} [optional]: The account address to use for the verification.
   *   - `nonce` {number} [optional]: The nonce for the transaction, if applicable.
   *   - `registeredVk` {boolean} [optional]: Whether to use a registered verification key.
   *   - `domainId` {number} [optional]: The domain ID for domain-specific operations.
   *   - `atBlock` {number | string} [optional]: The block at which to run the optimistic verification.
   * @param {VerifyInput[]} input - An array of verification input, which must be one of the following:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   - Ensure only one of these options is provided within the `VerifyInput`.
   * @returns {Promise<OptimisticVerifyResult>} A dry-run result summary.
   *
   * @throws {Error} If not connected to a custom network or called in read-only mode.
   */
  private async executeBatchOptimisticVerify(
    options: OptimisticVerifyOptions,
    input: VerifyInput[],
  ): Promise<OptimisticVerifyResult> {
    checkReadOnly(this.connectionManager.connectionDetails);

    if (!this.connectionManager.customNetwork) {
      throw new Error(
        'Optimistic batch verification is only supported on custom networks.',
      );
    }

    return batchOptimisticVerify(
      this.connectionManager.connectionDetails as
        | AccountConnection
        | WalletConnection,
      options,
      input,
    );
  }
}
