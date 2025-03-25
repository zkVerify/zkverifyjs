import { handleTransaction } from '../../utils/transactions';
import { AccountConnection, WalletConnection } from '../connection/types';
import { EventEmitter } from 'events';
import { VerifyTransactionInfo, ProofData } from '../../types';
import { VerifyOptions } from '../../session/types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { format } from '../format';
import { createSubmitProofExtrinsic } from '../extrinsic';
import { VerifyInput } from './types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { FormattedProofData } from '../format/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { getKeyringAccountIfAvailable } from '../../utils/helpers';

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

    if (input.domainId != null) {
      options.domainId = input.domainId;
    }

    const transaction: SubmittableExtrinsic<'promise'> = (() => {
      if ('proofData' in input && input.proofData) {
        const { proof, publicSignals, vk, version } =
          input.proofData as ProofData;
        const formatted: FormattedProofData = format(
          options.proofOptions,
          proof,
          publicSignals,
          vk,
          version,
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
          options,
          TransactionType.Verify,
        )
      : 'injector' in connection
        ? await handleTransaction(
            api,
            transaction,
            connection.accountAddress,
            connection.injector.signer,
            emitter,
            options,
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
