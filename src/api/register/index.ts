import { SubmittableExtrinsic } from '@polkadot/api/types';
import { EventEmitter } from 'events';
import { handleTransaction } from '../../utils/transactions';
import { getProofPallet, getProofProcessor } from '../../utils/helpers';
import { VKRegistrationTransactionInfo } from '../../types';
import { TransactionType, ZkVerifyEvents } from '../../enums';
import { AccountConnection } from '../connection/types';
import { VerifyOptions } from '../../session/types';
import { KeyringPair } from '@polkadot/keyring/types';

export async function registerVk(
  connection: AccountConnection,
  options: VerifyOptions,
  verificationKey: unknown,
): Promise<{
  events: EventEmitter;
  transactionResult: Promise<VKRegistrationTransactionInfo>;
}> {
  const { proofOptions, accountIdentifier } = options;
  const emitter = new EventEmitter();

  const processor = await getProofProcessor(proofOptions.proofType);
  if (!processor) {
    throw new Error(`Unsupported proof type: ${proofOptions.proofType}`);
  }

  if (verificationKey == null || verificationKey === '') {
    throw new Error(
      'verificationKey cannot be null, undefined, or an empty string',
    );
  }

  const formattedVk = processor.formatVk(verificationKey, proofOptions);
  const pallet = getProofPallet(proofOptions.proofType);
  if (!pallet) {
    throw new Error(`Unsupported proof type: ${proofOptions.proofType}`);
  }

  let selectedAccount: KeyringPair | undefined;

  if ('accounts' in connection) {
    if (accountIdentifier !== undefined) {
      if (typeof accountIdentifier === 'number') {
        selectedAccount = Array.from(connection.accounts.values())[
          accountIdentifier
        ];
      } else {
        selectedAccount = connection.accounts.get(accountIdentifier);
      }
    } else {
      selectedAccount = Array.from(connection.accounts.values())[0];
    }

    if (!selectedAccount) {
      throw new Error(`Account ${accountIdentifier ?? '0'} not found.`);
    }
  }

  const registerExtrinsic: SubmittableExtrinsic<'promise'> =
    connection.api.tx[pallet].registerVk(formattedVk);

  const transactionResult = new Promise<VKRegistrationTransactionInfo>(
    (resolve, reject) => {
      handleTransaction(
        connection.api,
        registerExtrinsic,
        selectedAccount as KeyringPair,
        undefined,
        emitter,
        options,
        TransactionType.VKRegistration,
      )
        .then(resolve)
        .catch((error) => {
          emitter.emit(ZkVerifyEvents.ErrorEvent, error);
          reject(error);
        });
    },
  );

  return { events: emitter, transactionResult };
}
