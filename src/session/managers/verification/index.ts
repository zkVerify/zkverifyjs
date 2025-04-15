import {
  OptimisticProofMethodMap,
  ProofMethodMap,
  VerifyOptions,
} from '../../types';
import { verify } from '../../../api/verify';
import { optimisticVerify } from '../../../api/optimisticVerify';
import { AllProofConfigs, ProofOptions, ProofType } from '../../../config';
import { VerificationBuilder } from '../../builders/verify';
import { OptimisticVerificationBuilder } from '../../builders/optimisticVerify';
import { validateProofTypeOptions } from '../../validator';
import { VerifyInput } from '../../../api/verify/types';
import { EventEmitter } from 'events';
import { VerifyTransactionInfo } from '../../../types';
import { checkReadOnly } from '../../../utils/helpers';
import { ConnectionManager } from '../connection';
import {
  AccountConnection,
  WalletConnection,
} from '../../../api/connection/types';

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
  optimisticVerify(): OptimisticProofMethodMap {
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

            return this.createOptimisticVerifyBuilder(proofOptions);
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
   * Factory method to create a `VerificationBuilder` for the given proof type.
   * The builder allows for chaining options and executing the verification process.
   *
   * @param {AllProofConfigs} proofOptions - The proof options object containing the proof type and its specific options.
   *   - Must include a valid `proofType` and associated options depending on the proof type:
   *     - Groth16: Requires `library` and `curve`.
   *     - Plonky2: Requires `compressed` (boolean) and `hashFunction`.
   *     - Risc0: Requires `version`.
   *     - Ultraplonk / ProofOfSql: No specific options required.
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
   *   - Must include a valid `proofType` and associated options depending on the proof type:
   *     - Groth16: Requires `library` and `curve`.
   *     - Plonky2: Requires `compressed` (boolean) and `hashFunction`.
   *     - Risc0: Requires `version`.
   *     - Ultraplonk / ProofOfSql: No specific options required.
   *
   * @returns {OptimisticVerificationBuilder} A new instance of `OptimisticVerificationBuilder` configured with the provided proof options.
   *
   * @throws {Error} If the provided proof options are invalid or incomplete.
   * @private
   */
  private createOptimisticVerifyBuilder(
    proofOptions: ProofOptions,
  ): OptimisticVerificationBuilder {
    return new OptimisticVerificationBuilder(
      this.executeOptimisticVerify.bind(this),
      proofOptions,
    );
  }

  /**
   * Executes the verification process with the provided proof options and proof data or pre-built extrinsic.
   * This method is intended to be called by the `VerificationBuilder`.
   *
   * @param {VerifyOptions} options - The options for the verification process, including:
   *   - `proofOptions` {AllProofOptions}: Contains the proof type and associated options depending on the type:
   *       - Groth16: Requires `library` and `curve`.
   *       - Plonky2: Requires `compressed` (boolean) and `hashFunction`.
   *       - Risc0: Requires `version`.
   *       - Ultraplonk / ProofOfSql: No specific options required.
   *   - `accountAddress` {string} [optional]: The account address to use for the verification.
   *   - `nonce` {number} [optional]: The nonce for the transaction, if applicable.
   *   - `registeredVk` {boolean} [optional]: Whether to use a registered verification key.
   *   - `domainId` {number} [optional]: The domain ID for domain-specific operations.
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
    options: VerifyOptions,
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
   * @param {AllProofConfigs} proofOptions - The proof options, including:
   *   - `proofType` {ProofType}: The type of proof to be verified.
   *   - Depending on the `proofType`, the following additional properties may be required:
   *     - Groth16: `library` and `curve` (as part of `Groth16Options`).
   *     - Plonky2: `compressed` (boolean) and `hashFunction` (as part of `Plonky2Options`).
   *     - Risc0: `version` (as part of `Risc0Options`).
   *     - Ultraplonk / ProofOfSql: No specific options required.
   *
   * @param {VerifyInput} input - The verification input, which must be one of the following:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   - Ensure only one of these options is provided within the `VerifyInput`.
   *
   * @returns {Promise<{ success: boolean; message: string }>}
   *   A promise that resolves to an object containing:
   *   - `success`: A boolean indicating whether the optimistic verification was successful.
   *   - `message`: A message providing additional details about the verification result.
   *
   * @throws {Error} If the session is in read-only mode.
   * @throws {Error} If not connected to a custom network.
   * @private
   */
  private async executeOptimisticVerify(
    proofOptions: ProofOptions,
    input: VerifyInput,
  ): Promise<{ success: boolean; message: string }> {
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
      proofOptions,
      input,
    );
  }
}
