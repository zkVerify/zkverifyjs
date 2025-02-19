import { ProofOptions, VerifyOptions } from '../../types';
import { CurveType, Library, ProofType } from '../../../config';
import { EventEmitter } from 'events';
import { VKRegistrationTransactionInfo } from '../../../types';

export type RegisterKeyMethodMap = {
  [K in keyof typeof ProofType]: (
    library?: Library,
    curve?: CurveType,
  ) => RegisterKeyBuilder;
};

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

  nonce(nonce: number): this {
    if (this.nonceSet) {
      throw new Error('Nonce can only be set once.');
    }
    this.nonceSet = true;
    this.options.nonce = nonce;
    return this;
  }

  async execute(verificationKey: unknown): Promise<{
    events: EventEmitter;
    transactionResult: Promise<VKRegistrationTransactionInfo>;
  }> {
    return this.executeRegisterVerificationKey(this.options, verificationKey);
  }
}
