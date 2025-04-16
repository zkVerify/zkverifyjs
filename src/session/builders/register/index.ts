import { VerifyOptions } from '../../types';
import { ProofOptions } from '../../../config';
import { EventEmitter } from 'events';
import { VKRegistrationTransactionInfo } from '../../../types';

export class RegisterKeyBuilder {
  private readonly options: VerifyOptions;
  private nonceSet = false;

  constructor(
    private readonly executeRegisterVerificationKey: (
      options: VerifyOptions,
      verificationKey: unknown,
    ) => Promise<{
      events: EventEmitter;
      transactionResult: Promise<VKRegistrationTransactionInfo>;
    }>,
    proofOptions: ProofOptions,
    accountAddress?: string,
  ) {
    this.options = { proofOptions, accountAddress };
  }

  /**
   * Sets the nonce for the registration process.
   * Can only be set once; subsequent calls will throw an error.
   *
   * @param {number} nonce - The nonce value to set.
   * @returns {this} The builder instance for method chaining.
   * @throws {Error} If the nonce is already set.
   */
  nonce(nonce: number): this {
    if (this.nonceSet) {
      throw new Error('Nonce can only be set once.');
    }
    this.nonceSet = true;
    this.options.nonce = nonce;
    return this;
  }

  /**
   * Executes the registration process with the provided verification key.
   *
   * @param {unknown} verificationKey - The verification key to register.
   * @returns {Promise<{ events: EventEmitter, transactionResult: Promise<VKRegistrationTransactionInfo> }>}
   */
  async execute(verificationKey: unknown): Promise<{
    events: EventEmitter;
    transactionResult: Promise<VKRegistrationTransactionInfo>;
  }> {
    return this.executeRegisterVerificationKey(this.options, verificationKey);
  }
}
