import { VerifyOptions } from '../../types';
import { EventEmitter } from 'events';
import { BatchVerifyTransactionInfo } from '../../../types';
import { VerifyInput } from '../../../api/verify/types';
import { ProofOptions } from '../../../config';

export class BatchVerificationBuilder {
  private readonly options: VerifyOptions;
  private nonceSet = false;
  private registeredVkSet = false;

  constructor(
    private readonly batchExecuteVerify: (
      options: VerifyOptions,
      input: VerifyInput[],
    ) => Promise<{
      events: EventEmitter;
      transactionResult: Promise<BatchVerifyTransactionInfo>;
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

  async execute(input: VerifyInput[]): Promise<{
    events: EventEmitter;
    transactionResult: Promise<BatchVerifyTransactionInfo>;
  }> {
    return this.batchExecuteVerify(this.options, input);
  }
}
