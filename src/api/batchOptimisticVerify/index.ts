import { AccountConnection, WalletConnection } from '../connection/types';
import { VerifyInput } from '../verify/types';
import { VerifyOptions } from '../../session/types';
import { optimisticVerify } from '../optimisticVerify';

export const batchOptimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: VerifyOptions,
  input: VerifyInput[],
): Promise<{ success: boolean; message: string }> => {
  for (let i = 0; i < input.length; i++) {
    const result = await optimisticVerify(connection, options, input[i]);
    if (!result.success) {
      return {
        success: false,
        message: `Proof at index ${i} failed: ${result.message}`,
      };
    }
  }

  return {
    success: true,
    message: 'Optimistic Verification Successful!',
  };
};
