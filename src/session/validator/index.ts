import { ProofOptions, ProofType } from '../../config';
import {
  isGroth16Config,
  isPlonky2Config,
  isRisc0Config,
  isUltraplonkConfig,
  isUltrahonkConfig,
} from '../../utils/helpers';

/**
 * Validates the options provided for a given proof type.
 * @throws {Error} - If the validation fails.
 */
export function validateProofTypeOptions(options: ProofOptions): void {
  const { proofType } = options;

  if (!proofType) {
    throw new Error('Proof type is required.');
  }

  switch (proofType) {
    case ProofType.groth16:
      if (!isGroth16Config(options)) {
        throw new Error(
          `Proof type '${proofType}' requires both 'library' and 'curve' options.`,
        );
      }
      break;

    case ProofType.plonky2:
      if (!isPlonky2Config(options)) {
        throw new Error(
          `Proof type '${proofType}' requires 'compressed' (boolean) and 'hashFunction' options.`,
        );
      }
      break;

    case ProofType.risc0:
      if (!isRisc0Config(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'version' option.`,
        );
      }
      break;

    case ProofType.ultraplonk:
      if (!isUltraplonkConfig(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'numberOfPublicInputs' option.`,
        );
      }
      break;
    case ProofType.ultrahonk:
      if (!isUltrahonkConfig(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'variant' option.`,
        );
      }
      break;
    case ProofType.fflonk:
    case ProofType.sp1:
      // No specific options required for these proof types
      break;
    //ADD_NEW_PROOF_TYPE config validation per proof type

    default:
      void (options as never);
      throw new Error(
        `Unsupported proof type: ${(options as { proofType: string }).proofType}`,
      );
  }
}
