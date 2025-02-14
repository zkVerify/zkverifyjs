import { ProofOptions, VerifyOptions } from '../../types';
import { verify } from '../../../api/verify';
import { optimisticVerify } from '../../../api/optimisticVerify';
import { ProofType, Library, CurveType } from '../../../config';
import { ProofMethodMap, VerificationBuilder } from '../../builders/verify';
import {
  OptimisticProofMethodMap,
  OptimisticVerificationBuilder,
} from '../../builders/optimisticVerify';
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
   * @returns {ProofMethodMap} A map of proof types to their corresponding builder methods.
   */
  verify(): ProofMethodMap {
    const builderMethods: Partial<ProofMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (library?: Library, curve?: CurveType) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              library,
              curve,
            };

            validateProofTypeOptions(proofOptions);

            return this.createVerifyBuilder(proofOptions);
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
          value: (library?: Library, curve?: CurveType) => {
            const proofOptions: ProofOptions = {
              proofType: proofType as ProofType,
              library,
              curve,
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
   * The builder allows for chaining options and finally executing the verification process.
   *
   * @param {ProofType} proofType - The type of proof to be used.
   * @param {Library} [library] - The optional library to be used, if required by the proof type.
   * @param {CurveType} [curve] - The optional curve to be used, if required by the proof type.
   * @returns {VerificationBuilder} A new instance of `VerificationBuilder`.
   * @private
   */
  private createVerifyBuilder(proofOptions: ProofOptions): VerificationBuilder {
    return new VerificationBuilder(this.executeVerify.bind(this), proofOptions);
  }

  /**
   * Factory method to create an `OptimisticVerificationBuilder` for the given proof type.
   * @param {ProofOptions} proofOptions - The proof options to use.
   * @returns {OptimisticVerificationBuilder} A new instance of `OptimisticVerificationBuilder`.
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
   * Executes the verification process with the provided options and proof data or pre-built extrinsic.
   * This method is intended to be called by the `VerificationBuilder`.
   *
   * @param {VerifyOptions} options - The options for the verification process, including proof type and other optional settings.
   * @param {VerifyInput} input - The verification input, which can be provided as either:
   *   - `proofData`: An array of proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic`.
   *   Ensure only one of these options is provided within the `VerifyInput`.
   *
   * @returns {Promise<{events: EventEmitter, transactionResult: Promise<VerifyTransactionInfo>}>}
   * A promise that resolves with an object containing:
   *   - `events`: An `EventEmitter` instance for real-time verification events.
   *   - `transactionResult`: A promise that resolves to the final transaction information once verification is complete.
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
   * @param {ProofOptions} proofOptions - The proof options, including proof type and associated parameters.
   * @param {VerifyInput} input - The verification input, which can be:
   *   - `proofData`: An object containing proof parameters (proof, public signals, and verification key).
   *   - `extrinsic`: A pre-built `SubmittableExtrinsic` for verification.
   *
   * @returns {Promise<{ success: boolean; error?: Error }>} A promise that resolves to an object containing:
   *   - `success`: A boolean indicating whether the verification was successful.
   *   - `error`: An optional `Error` object providing details about the failure, if applicable.
   *
   * @throws {Error} If the session is in read-only mode.
   * @throws {Error} If not connected to a Custom Network.
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
