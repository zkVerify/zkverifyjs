import { AccountConnection, WalletConnection } from '../connection/types.js';
import { createSubmitProofExtrinsic } from '../extrinsic/index.js';
import { format } from '../format/index.js';
import {
  OptimisticVerificationResultType,
  OptimisticVerifyResult,
  ProofData,
} from '../../types.js';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types.js';
import { VerifyInput } from '../verify/types.js';
import {
  getKeyringAccountIfAvailable,
  interpretDryRunResponse,
  toSubmittableExtrinsic,
} from '../../utils/helpers/index.js';
import { ApiPromise } from '@polkadot/api';
import { OptimisticVerifyOptions } from '../../session/types.js';
import { KeyringPair } from '@polkadot/keyring/types';

/**
 * Mortal era period, in blocks, applied to the dry-run payload.
 *
 * `system.dryRun` verifies the signature, so optimistic verification has to submit a
 * genuinely signed extrinsic — and that payload is transmitted to the RPC endpoint.
 * Signing it with an immortal era (`era: 0`) would leave a permanently valid,
 * replayable transaction in the hands of whoever receives it: because the caller only
 * dry-ran and never submitted, the nonce is never consumed, so the endpoint (or anyone
 * who observes the payload) could broadcast it for real at any point in the future.
 * A short mortal era bounds that window to a few blocks.
 */
const DRY_RUN_ERA_PERIOD = 64;

/**
 * Resolves the optional caller-supplied block reference to a block hash.
 *
 * @returns The block hash to dry-run against, or `undefined` to use the current head.
 */
const resolveBlockHash = async (
  api: ApiPromise,
  block: number | string | undefined,
): Promise<string | undefined> => {
  if (block === undefined) {
    return undefined;
  }

  if (typeof block === 'number') {
    return (await api.rpc.chain.getBlockHash(block)).toHex();
  }

  return block;
};

/**
 * Signs the dry-run payload with a short mortal era.
 *
 * When the caller pins a specific (possibly historical) block, the era is anchored at
 * that block's parent — an era anchored at the current head would be rejected by the
 * runtime's mortality check when executed against older state. The parent rather than
 * the pinned block itself, because `frame_system` only records `BlockHash[n]` while
 * initializing block `n + 1`, so state at the pinned block cannot resolve its own hash
 * and the signed payload would not match. This mirrors polkadot-js, which also anchors
 * at the parent of the best block. Otherwise `era` is omitted so polkadot-js applies
 * the same mortal-era logic it uses for real submissions.
 */
const signForDryRun = async (
  api: ApiPromise,
  transaction: SubmittableExtrinsic<'promise'>,
  account: KeyringPair,
  nonce: number,
  atBlockHash: string | undefined,
): Promise<void> => {
  if (atBlockHash === undefined) {
    await transaction.signAsync(account, { nonce });
    return;
  }

  const header = await api.rpc.chain.getHeader(atBlockHash);
  const blockNumber = header.number.toNumber();

  // Genesis has no parent; its hash is recorded at genesis build, so anchor there.
  const anchorNumber = blockNumber > 0 ? blockNumber - 1 : 0;
  const anchorHash = blockNumber > 0 ? header.parentHash.toHex() : atBlockHash;

  const era = api.registry.createType('ExtrinsicEra', {
    current: anchorNumber,
    period: DRY_RUN_ERA_PERIOD,
  });

  await transaction.signAsync(account, {
    nonce,
    era,
    blockHash: anchorHash,
  });
};

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

    // Resolved before signing: the mortal era is anchored to this block.
    const atBlockHash = await resolveBlockHash(api, options.block);

    await signForDryRun(api, transaction, selectedAccount, nonce, atBlockHash);

    const txHex = transaction.toHex();

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
