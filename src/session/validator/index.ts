import {
  ProofOptions,
  ProofType,
  TeeConfig,
  UltrahonkConfig,
} from '../../config';
import {
  isGroth16Config,
  isPlonky2Config,
  isRisc0Config,
  isUltraplonkConfig,
  isUltrahonkConfig,
  isVersionedUltrahonkConfig,
  isVersionAtLeast,
  requireVersionAtLeast,
} from '../../utils/helpers';
import { RuntimeSpec } from '../../types';
import { RuntimeVersion, TeeVariant, UltrahonkVersion } from '../../enums';

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
      if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_0)) {
        defaultUltrahonkVersion(options);

        if (!isVersionedUltrahonkConfig(options)) {
          throw new Error(
            `Proof type '${proofType}' requires 'version' and 'variant' options for runtime version 1.6.0 or later.`,
          );
        }
      } else {
        const config = options.config as UltrahonkConfig | undefined;

        if (config?.version !== undefined) {
          throw new Error(
            `Proof type '${proofType}' does not support a 'version' option before runtime version 1.6.0.`,
          );
        }

        if (!isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_3_0)) {
          break;
        }

        if (!isUltrahonkConfig(options)) {
          throw new Error(
            `Proof type '${proofType}' requires a 'variant' option for runtime version 1.3.0 or later.`,
          );
        }
      }
      break;
    case ProofType.ezkl:
      requireVersionAtLeast(
        runtimeSpec,
        RuntimeVersion.V1_3_0,
        'EZKL proof type',
      );
      break;
    case ProofType.fflonk:
    case ProofType.sp1:
      // No specific options required for these proof types
      break;
    case ProofType.tee:
      requireVersionAtLeast(
        runtimeSpec,
        RuntimeVersion.V1_5_0,
        'TEE proof type',
      );
      if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_0)) {
        defaultTeeVariant(options);
      } else if (!isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_0)) {
        const config = options.config as TeeConfig | undefined;

        if (config?.variant !== undefined) {
          throw new Error(
            `Proof type '${proofType}' does not support a 'variant' option before runtime version 1.6.0.`,
          );
        }
      }
      break;
    // ADD_NEW_PROOF_TYPE config validation per proof type
    // ADD RUNTIME SPECIFIC RULE IF NEEDED USING requireVersionAtLeast

    default:
      void (options as never);
      throw new Error(
        `Unsupported proof type: ${(options as { proofType: string }).proofType}`,
      );
  }
}

function defaultUltrahonkVersion(options: ProofOptions): void {
  const config = options.config as UltrahonkConfig | undefined;

  if (config?.variant === undefined || config.version !== undefined) {
    return;
  }

  options.config = {
    ...config,
    version: UltrahonkVersion.V0_84,
  };

  console.warn(
    `zkverifyjs: Proof type '${ProofType.ultrahonk}' now supports versioned proofs on runtime version 1.6.0 or later. Defaulting missing 'version' to '${UltrahonkVersion.V0_84}' for backwards compatibility. Pass 'version' explicitly to silence this warning.`,
  );
}

function defaultTeeVariant(options: ProofOptions): void {
  const config = options.config as TeeConfig | undefined;

  if (config?.variant !== undefined) {
    return;
  }

  options.config = {
    ...config,
    variant: TeeVariant.Intel,
  };

  console.warn(
    `zkverifyjs: Proof type '${ProofType.tee}' now supports variant verification keys on runtime version 1.6.0 or later. Defaulting missing 'variant' to '${TeeVariant.Intel}' for backwards compatibility. Pass 'variant' explicitly to silence this warning.`,
  );
}
