import { AccountConnection, WalletConnection } from '../connection/types';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { format } from '../format';
import { ProofData } from '../../types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { VerifyInput } from '../verify/types';
import { interpretDryRunResponse } from '../../utils/helpers';
import { ApiPromise } from '@polkadot/api';
import { VerifyOptions } from '../../session/types';

export const batchOptimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  input: VerifyInput[],
): Promise<{ success: boolean; message: string }> => {
  const { api } = connection;

  try {
    const transaction = buildBatchTransaction(api, options, input);

    const submittableExtrinsicHex = transaction.toHex();
    const dryRunResult = await api.rpc.system.dryRun(submittableExtrinsicHex);
    const { success, message } = await interpretDryRunResponse(
      api,
      dryRunResult.toHex(),
    );

    return { success, message };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Optimistic batch verification failed: ${errorMessage}`,
    };
  }
};

/**
 * Builds a batched transaction from multiple inputs.
 * @param api - The Polkadot.js API instance.
 * @param options - Options for the proofs.
 * @param inputs - Array of VerifyInput.
 * @returns A SubmittableExtrinsic ready for dryRun.
 * @throws If inputs are invalid or cannot be formatted.
 */
const buildBatchTransaction = (
  api: ApiPromise,
  options: VerifyOptions,
  inputs: VerifyInput[],
): SubmittableExtrinsic<'promise'> => {
  if (inputs.length === 0) {
    throw new Error('No proofs provided for batch optimistic verification.');
  }

  const calls = inputs.map((input) => {
    if ('proofData' in input && input.proofData) {
      const { proof, publicSignals, vk } = input.proofData as ProofData;
      const formatted: FormattedProofData = format(
        options.proofOptions,
        proof,
        publicSignals,
        vk,
        options.registeredVk,
      );
      return createSubmitProofExtrinsic(
        api,
        options.proofOptions.proofType,
        formatted,
        input.domainId,
      );
    }

    if ('extrinsic' in input && input.extrinsic) {
      return input.extrinsic;
    }

    throw new Error(
      `Invalid input provided. Expected either 'proofData' or 'extrinsic'. Received: ${JSON.stringify(input)}`,
    );
  });

  return api.tx.utility.batchAll(calls);
};
