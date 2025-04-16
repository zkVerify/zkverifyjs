import { VerifyInput } from '../../../api/verify/types';
import { ProofOptions } from '../../../config';

export class OptimisticVerificationBuilder {
  constructor(
    private readonly executeOptimisticVerify: (
      proofOptions: ProofOptions,
      input: VerifyInput,
    ) => Promise<{ success: boolean; message: string }>,
    private readonly proofOptions: ProofOptions,
  ) {}

  /**
   * Executes the optimistic verification process.
   * @param {VerifyInput} input - Input for the verification, either proofData or an extrinsic.
   * @returns {Promise<{ success: boolean; message: string }>} Resolves with an object indicating success or failure and any message.
   */
  async execute(
    input: VerifyInput,
  ): Promise<{ success: boolean; message: string }> {
    return this.executeOptimisticVerify(this.proofOptions, input);
  }
}
