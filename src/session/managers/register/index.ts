import { RegisterKeyBuilder } from '../../builders/register/index.js';
import {
  AllProofConfigs,
  ProofOptions,
  ProofType,
} from '../../../config/index.js';
import { RegisterKeyMethodMap, VerifyOptions } from '../../types.js';
import { registerVk } from '../../../api/register/index.js';
import { checkReadOnly } from '../../../utils/helpers/index.js';
import { AccountConnection } from '../../../api/connection/types.js';
import { VKRegistrationTransactionInfo } from '../../../types.js';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection/index.js';
import { validateProofTypeOptions } from '../../validator/index.js';

export class VerificationKeyRegistrationManager {
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Creates a builder map for different proof types that can be used for registering verification keys.
   * Each proof type returns a `RegisterKeyBuilder` that allows you to chain methods for setting options
   * and finally executing the registration process.
   *
   * @returns {RegisterKeyMethodMap} A map of proof types to their corresponding builder methods.
   */
  registerVerificationKey(accountAddress?: string): RegisterKeyMethodMap {
    const builderMethods: Partial<RegisterKeyMethodMap> = {};

    for (const proofType in ProofType) {
      if (Object.prototype.hasOwnProperty.call(ProofType, proofType)) {
        Object.defineProperty(builderMethods, proofType, {
          value: (proofConfig?: AllProofConfigs | null) => {
            const validatedOptions = validateProofTypeOptions(
              {
                proofType: proofType as ProofType,
                config: proofConfig ?? undefined,
              },
              this.connectionManager.connectionDetails.runtimeSpec,
            );

            return this.createRegisterKeyBuilder(
              validatedOptions,
              accountAddress,
            );
          },
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }

    return builderMethods as RegisterKeyMethodMap;
  }

  /**
   * Factory method to create a `RegisterKeyBuilder` for the given proof type.
   * The builder allows for chaining options and finally executing the key registration process.
   *
   * @returns {RegisterKeyBuilder} A new instance of `RegisterKeyBuilder`.
   * @private
   */
  private createRegisterKeyBuilder(
    proofOptions: ProofOptions,
    accountAddress?: string,
  ): RegisterKeyBuilder {
    return new RegisterKeyBuilder(
      this.executeRegisterVerificationKey.bind(this),
      proofOptions,
      accountAddress,
    );
  }

  /**
   * Executes the verification key registration process with the provided options and verification key.
   * This method is intended to be called by the `RegisterKeyBuilder`.
   *
   * @param {VerifyOptions} options - The options for the key registration process, including proof type and other optional settings.
   * @param {unknown} verificationKey - The verification key to be registered.
   * @returns {Promise<{events: EventEmitter, transactionResult: Promise<VKRegistrationTransactionInfo>}>}
   * A promise that resolves with an object containing an `EventEmitter` for real-time events and the final transaction result.
   * @private
   */
  private async executeRegisterVerificationKey(
    options: VerifyOptions,
    verificationKey: unknown,
  ): Promise<{
    events: EventEmitter;
    transactionResult: Promise<VKRegistrationTransactionInfo>;
  }> {
    checkReadOnly(this.connectionManager.connectionDetails);

    return registerVk(
      this.connectionManager.connectionDetails as AccountConnection,
      options,
      verificationKey,
    );
  }
}
