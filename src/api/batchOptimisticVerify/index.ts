import { AccountConnection, WalletConnection } from '../connection/types';
import { VerifyInput } from '../verify/types';
import { OptimisticVerifyOptions } from '../../session/types';
import { optimisticVerify } from '../optimisticVerify';
import { OptimisticVerifyResult } from '../../types';

export const batchOptimisticVerify = async (
  connection: AccountConnection | WalletConnection,
  options: OptimisticVerifyOptions,
  input: VerifyInput[],
): Promise<OptimisticVerifyResult> => {
  for (let i = 0; i < input.length; i++) {
    const res = await optimisticVerify(connection, options, input[i]);
    if (!res.success) {
      return {
        success: false,
        type: res.type,
        message: `Proof at index ${i} failed: ${res.message}`,
        code: res.code,
        verificationError: res.verificationError,
        failedIndex: i,
      };
    }
  }
  return {
    success: true,
    type: 'ok',
    message: 'Optimistic Verification Successful!',
  };
};
