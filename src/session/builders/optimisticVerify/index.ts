import { VerifyInput } from '../../../api/verify/types.js';
import { ProofOptions } from '../../../config/index.js';
import { OptimisticVerifyOptions } from '../../types.js';
import { OptimisticVerifyResult } from '../../../types.js';

export class OptimisticVerificationBuilder {
  private readonly options: OptimisticVerifyOptions;
  private nonceSet = false;
  private registeredVkSet = false;
  private blockSet = false;

  constructor(
    private readonly executeOptimisticVerify: (
      options: OptimisticVerifyOptions,
      input: VerifyInput,
    ) => Promise<OptimisticVerifyResult>,
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

  atBlock(block: number | string): this {
    if (this.blockSet) throw new Error('atBlock can only be set once.');
    this.blockSet = true;
    this.options.block = block;
    return this;
  }

  async execute(input: VerifyInput): Promise<OptimisticVerifyResult> {
    return this.executeOptimisticVerify(this.options, input);
  }
}
