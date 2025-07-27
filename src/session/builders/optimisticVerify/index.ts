import { VerifyInput } from '../../../api/verify/types';
import { ProofOptions } from '../../../config';
import { VerifyOptions } from '../../types';

export class OptimisticVerificationBuilder {
  private readonly options: VerifyOptions;
  private nonceSet = false;
  private registeredVkSet = false;

  constructor(
    private readonly executeOptimisticVerify: (
      options: VerifyOptions,
      input: VerifyInput,
    ) => Promise<{ success: boolean; message: string }>,
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

  async execute(
    input: VerifyInput,
  ): Promise<{ success: boolean; message: string }> {
    return this.executeOptimisticVerify(this.options, input);
  }
}
