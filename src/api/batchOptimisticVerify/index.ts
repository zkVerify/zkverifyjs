import { AccountConnection, WalletConnection } from '../connection/types';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { format } from '../format';
import { ProofData } from '../../types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { VerifyInput } from '../verify/types';
import { interpretDryRunResponse } from '../../utils/helpers';
import { VerifyOptions } from '../../session/types';

export const batchOptimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  input: VerifyInput[],
): Promise<{ success: boolean; message: string }> => {
  const { api } = connection;

  if (input.length === 0) {
    return {
      success: false,
      message: 'No proofs provided for batch optimistic verification.',
    };
  }

  const calls: SubmittableExtrinsic<'promise'>[] = [];
  let formatError: Error | null = null;

  for (let i = 0; i < input.length; i++) {
    const current = input[i];
    try {
      if ('proofData' in current && current.proofData) {
        const { proof, publicSignals, vk } = current.proofData as ProofData;
        const formatted: FormattedProofData = format(
          options.proofOptions,
          proof,
          publicSignals,
          vk,
          options.registeredVk,
        );
        calls.push(
          createSubmitProofExtrinsic(
            api,
            options.proofOptions.proofType,
            formatted,
            current.domainId,
          ),
        );
      } else if ('extrinsic' in current && current.extrinsic) {
        calls.push(current.extrinsic);
      } else {
        throw new Error('Missing both proofData and extrinsic.');
      }
    } catch (err) {
      formatError = new Error(
        `Failed to format proof at batch index ${i}: ${(err as Error).message}`,
      );
      break;
    }
  }

  if (formatError) {
    return {
      success: false,
      message: formatError.message,
    };
  }

  try {
    const batchTx = api.tx.utility.batchAll(calls);
    const dryRunResult = await api.rpc.system.dryRun(batchTx.toHex());
    const { success, message } = await interpretDryRunResponse(
      api,
      dryRunResult.toHex(),
    );

    return { success, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Optimistic batch verification failed: ${message}`,
    };
  }
};
