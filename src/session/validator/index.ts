import { ProofOptions, ProofType } from '../../config';
import {
  isGroth16Config,
  isPlonky2Config,
  isRisc0Config,
  isUltraplonkConfig,
  isUltrahonkConfig,
  isVersionAtLeast,
} from '../../utils/helpers';
import { RuntimeSpec } from '../../types';
import { RuntimeVersion } from '../../enums';

/**
 * Validates the options provided for a given proof type.
 * @param options - The proof options to validate.
 * @param runtimeSpec - Runtime spec for version-dependent validation.
 * @throws {Error} - If the validation fails.
 */
export function validateProofTypeOptions(
  options: ProofOptions,
  runtimeSpec: RuntimeSpec,
): void {
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
      if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_3_0)) {
        if (!isUltrahonkConfig(options)) {
          throw new Error(
            `Proof type '${proofType}' requires a 'variant' option for runtime version 1.3.0 or later.`,
          );
        }
      }
      break;
    case ProofType.ezkl:
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
