import { AccountConnection, WalletConnection } from '../connection/types';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { format } from '../format';
import {
  OptimisticVerificationResultType,
  OptimisticVerifyResult,
  ProofData,
} from '../../types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { VerifyInput } from '../verify/types';
import {
  getKeyringAccountIfAvailable,
  interpretDryRunResponse,
  toSubmittableExtrinsic,
} from '../../utils/helpers';
import { ApiPromise } from '@polkadot/api';
import { OptimisticVerifyOptions } from '../../session/types';
import { KeyringPair } from '@polkadot/keyring/types';

export const optimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: OptimisticVerifyOptions,
  input: VerifyInput,
): Promise<OptimisticVerifyResult> => {
  const { api } = connection;

  try {
    const transaction = buildTransaction(api, options, input);

    const selectedAccount: KeyringPair | undefined =
      getKeyringAccountIfAvailable(connection, options.accountAddress);

    if (!selectedAccount) {
      throw new Error(
        'No active session account available for optimisticVerify',
      );
    }

    const nonce = options.nonce ?? -1;
    await transaction.signAsync(selectedAccount, { nonce, era: 0 });

    const txHex = transaction.toHex();
    let atBlockHash;

    if (options.block !== undefined) {
      if (typeof options.block === 'number') {
        atBlockHash = await api.rpc.chain.getBlockHash(options.block);
      } else if (typeof options.block === 'string') {
        atBlockHash = options.block;
      }
    } else {
      atBlockHash = undefined;
    }

    const dryRun = atBlockHash
      ? await api.rpc.system.dryRun(txHex, atBlockHash)
      : await api.rpc.system.dryRun(txHex);

    return interpretDryRunResponse(
      api,
      dryRun.toHex(),
      options.proofOptions?.proofType,
    );
  } catch (e) {
    return {
      success: false,
      type: OptimisticVerificationResultType.TransportError,
      message: `Optimistic verification failed: ${e instanceof Error ? e.message : String(e)}`,
      verificationError: false,
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
  options: OptimisticVerifyOptions,
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
    return toSubmittableExtrinsic(input.extrinsic, api);
  }

  throw new Error(
    `Invalid input provided. Expected either 'proofData' or 'extrinsic'. Received: ${JSON.stringify(input)}`,
  );
};
