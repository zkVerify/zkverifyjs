import { VerifyInput } from '../../../api/verify/types';
import { ProofOptions } from '../../../config';
import { VerifyOptions } from '../../types';

export class OptimisticVerificationBuilder {
  private readonly options: VerifyOptions;
  private registeredVkSet = false;

  constructor(
    private readonly executeOptimisticVerify: (
      options: VerifyOptions,
      input: VerifyInput,
    ) => Promise<{ success: boolean; message: string }>,
    proofOptions: ProofOptions,
  ) {
    this.options = { proofOptions };
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
