import { SubmittableExtrinsic } from '@polkadot/api/types';
import { EventEmitter } from 'events';
import { handleTransaction } from '../../utils/transactions';
import {
  extractErrorMessage,
  getProofPallet,
  getProofProcessor,
  getSelectedAccount,
} from '../../utils/helpers';
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
  const { api } = connection;
  const emitter = new EventEmitter();

  const transactionResult = new Promise<VKRegistrationTransactionInfo>(
    (resolve, reject) => {
      (async () => {
        try {
          const processor = await getProofProcessor(
            options.proofOptions.proofType,
          );
          if (!processor) {
            throw new Error(
              `Unsupported proof type: ${options.proofOptions.proofType}`,
            );
          }

          if (!verificationKey || verificationKey === '') {
            throw new Error(
              'verificationKey cannot be null, undefined, or an empty string',
            );
          }

          const formattedVk = processor.formatVk(
            verificationKey,
            options.proofOptions,
          );
          const pallet = getProofPallet(options.proofOptions.proofType);
          if (!pallet) {
            throw new Error(
              `Unsupported proof type: ${options.proofOptions.proofType}`,
            );
          }

          const selectedAccount = getSelectedAccount(
            connection,
            options.accountAddress,
          );

          const extrinsic: SubmittableExtrinsic<'promise'> =
            api.tx[pallet].registerVk(formattedVk);

          emitter.once(ZkVerifyEvents.ErrorEvent, (err) => {
            reject(new Error(extractErrorMessage(err)));
          });

          const result = await handleTransaction(
            api,
            extrinsic,
            selectedAccount as KeyringPair,
            undefined,
            emitter,
            options,
            TransactionType.VKRegistration,
          );

          emitter.removeAllListeners();
          resolve(result);
        } catch (err) {
          emitter.removeAllListeners();
          reject(new Error(extractErrorMessage(err)));
        }
      })();
    },
  );

  return { events: emitter, transactionResult };
}
