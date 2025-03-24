import { ProofOptions, VerifyOptions } from '../../types';
import { CurveType, Library, ProofType } from '../../../config';
import { EventEmitter } from 'events';
import { VerifyTransactionInfo } from '../../../types';
import { VerifyInput } from '../../../api/verify/types';

export type ProofMethodMap = {
  [K in keyof typeof ProofType]: (
    library?: Library,
    curve?: CurveType,
  ) => VerificationBuilder;
};

export class VerificationBuilder {
  private readonly options: VerifyOptions;
  private nonceSet = false;
  private registeredVkSet = false;

  constructor(
    private readonly executeVerify: (
      options: VerifyOptions,
      input: VerifyInput,
    ) => Promise<{
      events: EventEmitter;
      transactionResult: Promise<VerifyTransactionInfo>;
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

  withRegisteredVk(): this {
    if (this.registeredVkSet) {
      throw new Error('withRegisteredVk can only be set once.');
    }
    this.registeredVkSet = true;
    this.options.registeredVk = true;
    return this;
  }

  async execute(input: VerifyInput): Promise<{
    events: EventEmitter;
    transactionResult: Promise<VerifyTransactionInfo>;
  }> {
    return this.executeVerify(this.options, input);
  }
}
