import { AccountConnection, WalletConnection } from '../connection/types.js';
import { VerifyInput } from '../verify/types.js';
import { OptimisticVerifyOptions } from '../../session/types.js';
import { optimisticVerify } from '../optimisticVerify/index.js';
import { OptimisticVerifyResult } from '../../types.js';

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
