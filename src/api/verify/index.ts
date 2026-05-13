import { handleTransaction } from '../../utils/transactions/index.js';
import { AccountConnection, WalletConnection } from '../connection/types.js';
import { EventEmitter } from 'events';
import { VerifyTransactionInfo, ProofData } from '../../types.js';
import { VerifyOptions } from '../../session/types.js';
import { TransactionType, ZkVerifyEvents } from '../../enums.js';
import { format } from '../format/index.js';
import { createSubmitProofExtrinsic } from '../extrinsic/index.js';
import { VerifyInput } from './types.js';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types.js';
import { KeyringPair } from '@polkadot/keyring/types';
import {
  getKeyringAccountIfAvailable,
  toSubmittableExtrinsic,
} from '../../utils/helpers/index.js';

export const verify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  emitter: EventEmitter,
  input: VerifyInput,
): Promise<VerifyTransactionInfo> => {
  const { api } = connection;

  try {
    const selectedAccount: KeyringPair | undefined =
      getKeyringAccountIfAvailable(connection, options.accountAddress);

    const effectiveOptions: VerifyOptions =
      input.domainId != null
        ? { ...options, domainId: input.domainId }
        : options;

    const transaction: SubmittableExtrinsic<'promise'> = (() => {
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
        return toSubmittableExtrinsic(input.extrinsic, api);
      }

      throw new Error(
        'Invalid input: Either proofData or extrinsic must be provided.',
      );
    })();

    const result = selectedAccount
      ? await handleTransaction(
          api,
          transaction,
          selectedAccount,
          undefined,
          emitter,
          effectiveOptions,
          TransactionType.Verify,
        )
      : 'injector' in connection
        ? await handleTransaction(
            api,
            transaction,
            connection.accountAddress,
            connection.injector.signer,
            emitter,
            effectiveOptions,
            TransactionType.Verify,
          )
        : (() => {
            throw new Error('Unsupported connection type.');
          })();

    return result as VerifyTransactionInfo;
  } catch (error) {
    emitter.emit(ZkVerifyEvents.ErrorEvent, error);
    emitter.removeAllListeners();
    throw error;
  }
};
