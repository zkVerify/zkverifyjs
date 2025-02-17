import {
  createExtrinsicHex,
  createSubmitProofExtrinsic,
  createExtrinsicFromHex,
} from '../../../api/extrinsic';
import { estimateCost } from '../../../api/estimate';
import { checkReadOnly } from '../../../utils/helpers';
import { ConnectionManager } from '../connection';
import { FormattedProofData } from '../../../api/format/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ProofType } from '../../../config';
import { ExtrinsicCostEstimate } from '../../../api/estimate/types';
import { KeyringPair } from '@polkadot/keyring/types';

export class ExtrinsicManager {
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Creates a SubmittableExtrinsic using formatted proof details to enable submitting a proof.
   *
   * @param {ProofType} proofType - The type of proof, to decide which pallet to use.
   * @param {FormattedProofData} params - Formatted Proof Parameters required by the extrinsic.
   * @returns {SubmittableExtrinsic<'promise'>} The generated SubmittableExtrinsic for submission.
   * @throws {Error} - Throws an error if the extrinsic creation fails.
   */
  async createSubmitProofExtrinsic(
    proofType: ProofType,
    params: FormattedProofData,
  ): Promise<SubmittableExtrinsic<'promise'>> {
    return createSubmitProofExtrinsic(
      this.connectionManager.api,
      proofType,
      params,
    );
  }

  /**
   * Generates the hex representation of a SubmittableExtrinsic using formatted proof details.
   *
   * @param {ProofType} proofType - The type of supported proof, used to select the correct pallet.
   * @param {FormattedProofData} params - Formatted Proof Parameters required by the extrinsic.
   * @returns {string} Hex-encoded string of the SubmittableExtrinsic.
   * @throws {Error} - Throws an error if the hex generation fails.
   */
  async createExtrinsicHex(
    proofType: ProofType,
    params: FormattedProofData,
  ): Promise<string> {
    return createExtrinsicHex(this.connectionManager.api, proofType, params);
  }

  /**
   * Recreates an extrinsic from its hex-encoded representation.
   *
   * @param {string} extrinsicHex - Hex-encoded string of the SubmittableExtrinsic.
   * @returns {SubmittableExtrinsic<'promise'>} The reconstructed SubmittableExtrinsic.
   * @throws {Error} - Throws an error if the reconstruction from hex fails.
   */
  async createExtrinsicFromHex(
    extrinsicHex: string,
  ): Promise<SubmittableExtrinsic<'promise'>> {
    return createExtrinsicFromHex(this.connectionManager.api, extrinsicHex);
  }

  /**
   * Estimates the cost of a given extrinsic.
   *
   * @param {SubmittableExtrinsic<'promise'>} extrinsic - The extrinsic to estimate.
   * @param {string} [accountAddress] - The account address to use for estimation.
   * If not provided, the first available account will be used.
   * @returns {Promise<ExtrinsicCostEstimate>} A promise that resolves to an object containing the estimated fee and extrinsic details.
   * @throws {Error} If the session is in read-only mode or no account is available.
   */
  async estimateCost(
    extrinsic: SubmittableExtrinsic<'promise'>,
    accountAddress?: string,
  ): Promise<ExtrinsicCostEstimate> {
    checkReadOnly(this.connectionManager.connectionDetails);

    let selectedAccount: KeyringPair;

    if (accountAddress !== undefined) {
      selectedAccount = this.connectionManager.getAccount(accountAddress);
    } else {
      selectedAccount = this.connectionManager.getAccount();
    }

    return estimateCost(this.connectionManager.api, extrinsic, selectedAccount);
  }
}
