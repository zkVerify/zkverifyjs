import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { hexToU8a } from '@polkadot/util';
import { ProofType } from '../../config';
import { getProofPallet } from '../../utils/helpers';
import { FormattedProofData } from '../format/types';

/**
 * Creates a SubmittableExtrinsic using formatted proof details to enable submitting a proof.
 *
 * @param {ApiPromise} api - The Polkadot API instance.
 * @param {ProofType} proofType - The type of supported proof, used to select the correct pallet.
 * @param {FormattedProofData} params - Formatted Proof Parameters required by the extrinsic.
 * @param {number | null | undefined} domainId - The domain ID for the extrinsic (32-bit unsigned integer).
 * @returns {SubmittableExtrinsic<'promise'>} The generated SubmittableExtrinsic for submission.
 * @throws {Error} - Throws an error if the extrinsic creation fails.
 */
export const createSubmitProofExtrinsic = (
  api: ApiPromise,
  proofType: ProofType,
  params: FormattedProofData,
  domainId: number | null = null,
): SubmittableExtrinsic<'promise'> => {
  const pallet = getProofPallet(proofType);

  if (!pallet) {
    throw new Error(`Unsupported proof type: ${proofType}`);
  }

  try {
    return api.tx[pallet].submitProof(
      params.formattedVk,
      params.formattedProof,
      params.formattedPubs,
      domainId,
    );
  } catch (error: unknown) {
    throw new Error(formatError(error, proofType, params));
  }
};

/**
 * Generates the hex representation of a SubmittableExtrinsic using formatted proof details.
 *
 * @param {ApiPromise} api - The Polkadot API instance.
 * @param {ProofType} proofType - The type of supported proof, used to select the correct pallet.
 * @param {FormattedProofData} params - Formatted Proof Parameters required by the extrinsic.
 * @param {number | null | undefined} domainId - The domain ID for the extrinsic (32-bit unsigned integer).
 * @returns {string} Hex-encoded string of the SubmittableExtrinsic.
 * @throws {Error} - Throws an error if the extrinsic creation fails.
 */
export const createExtrinsicHex = (
  api: ApiPromise,
  proofType: ProofType,
  params: FormattedProofData,
  domainId?: number | null,
): string => {
  const extrinsic = createSubmitProofExtrinsic(
    api,
    proofType,
    params,
    domainId,
  );
  return extrinsic.toHex();
};

/**
 * Reconstructs a SubmittableExtrinsic from a hex-encoded extrinsic string.
 * The method is extracted and wrapped in a new submittable extrinsic.
 *
 * Note: This does not preserve the original signature.
 *
 * @param api - The Polkadot API instance.
 * @param extrinsicHex - Hex-encoded string of the extrinsic.
 * @returns A signable SubmittableExtrinsic<'promise'>.
 * @throws {Error} - If the extrinsic cannot be decoded or wrapped.
 */
export const createExtrinsicFromHex = (
  api: ApiPromise,
  extrinsicHex: string,
): SubmittableExtrinsic<'promise'> => {
  try {
    const decoded = api.createType('Extrinsic', hexToU8a(extrinsicHex));
    const call = api.createType('Call', decoded.method);
    return api.tx(call);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to reconstruct extrinsic from hex: ${message}`);
  }
};

/**
 * Formats a detailed error message for extrinsic creation errors.
 *
 * @param {unknown} error - The original error object encountered.
 * @param {ProofType} proofType - The type of supported proof, used to select the correct pallet.
 * @param {unknown[]} params - Parameters used when creating the extrinsic.
 * @returns {string} A formatted error message string with details.
 */
const formatError = (
  error: unknown,
  proofType: ProofType,
  params: FormattedProofData,
): string => {
  const errorMessage =
    error instanceof Error ? error.message : 'An unknown error occurred';
  return `Error creating submittable extrinsic: ${proofType} Params: ${JSON.stringify(params, null, 2)} ${errorMessage}`;
};
