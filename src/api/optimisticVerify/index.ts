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

export const optimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  input: VerifyInput,
): Promise<{ success: boolean; message: string }> => {
  const { api } = connection;

  try {
    const transaction = buildTransaction(api, options, input);

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
      message: `Optimistic verification failed: ${errorMessage}`,
    };
  }
};

/**
 * Builds a transaction from the provided input.
 * @param api - The Polkadot.js API instance.
 * @param options - Options for the proof.
 * @param input - Input for the verification (proofData or extrinsic).
 * @returns A SubmittableExtrinsic ready for dryRun.
 * @throws If input is invalid or cannot be formatted.
 */
const buildTransaction = (
  api: ApiPromise,
  options: VerifyOptions,
  input: VerifyInput,
): SubmittableExtrinsic<'promise'> => {
  if ('proofData' in input && input.proofData) {
    const { proof, publicSignals, vk } = input.proofData as ProofData;
    const formattedProofData: FormattedProofData = format(
      options.proofOptions,
      proof,
      publicSignals,
      vk,
      options.registeredVk,
    );
    return createSubmitProofExtrinsic(
      api,
      options.proofOptions.proofType,
      formattedProofData,
      input.domainId,
    );
  }

  if ('extrinsic' in input && input.extrinsic) {
    return input.extrinsic;
  }

  throw new Error(
    `Invalid input provided. Expected either 'proofData' or 'extrinsic'. Received: ${JSON.stringify(input)}`,
  );
};
