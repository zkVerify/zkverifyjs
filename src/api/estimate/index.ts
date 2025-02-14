import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ExtrinsicCostEstimate } from './types';
import { KeyringPair } from '@polkadot/keyring/types';

/**
 * Converts a fee in the smallest unit to the base token unit.
 *
 * @param {string} feeInSmallestUnit - Fee in the blockchain's smallest unit.
 * @param {number} decimals - The number of decimals in the blockchain's base token.
 * @returns {string} - The fee in the base token unit.
 */
export function convertFeeToToken(
  feeInSmallestUnit: string,
  decimals: number,
): string {
  const feeInTokens = parseFloat(feeInSmallestUnit) / Math.pow(10, decimals);
  return feeInTokens.toFixed(decimals);
}

/**
 * Estimates the cost of a given extrinsic for the specified account.
 *
 * @param {ApiPromise} api - The Polkadot API instance.
 * @param {SubmittableExtrinsic<'promise', ISubmittableResult>} extrinsic - The extrinsic to estimate.
 * @param {KeyringPair} account - The account to use.
 * @returns {Promise<ExtrinsicCostEstimate>} - A promise that resolves to an object containing the estimated fee and extrinsic details.
 */
export async function estimateCost(
  api: ApiPromise,
  extrinsic: SubmittableExtrinsic<'promise'>,
  account: KeyringPair,
): Promise<ExtrinsicCostEstimate> {
  const paymentInfo = await extrinsic.paymentInfo(account);
  const tokenDecimals = api.registry.chainDecimals[0];
  const estimatedFeeInTokens = convertFeeToToken(
    paymentInfo.partialFee.toString(),
    tokenDecimals,
  );

  return {
    partialFee: paymentInfo.partialFee.toString(),
    estimatedFeeInTokens,
    weight: paymentInfo.weight.toString(),
    length: extrinsic.length,
  };
}
