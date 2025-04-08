import { ProofType, ProofOptions } from '../../config';
import {
  isGroth16Config,
  isPlonky2Config,
  isRisc0Config,
} from '../../utils/helpers';

/**
 * Validates the options provided for a given proof type.
 * @throws {Error} - If the validation fails.
 */
export function validateProofTypeOptions(options: ProofOptions): void {
  const proofType = options.proofType;

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
    case ProofType.proofofsql:
      // No specific options required for these proof types
      break;

    default:
      void (options as never);
      throw new Error(
        `Unsupported proof type: ${(options as { proofType: string }).proofType}`,
      );
  }
}
