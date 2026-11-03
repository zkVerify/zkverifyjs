import {
  ProofOptions,
  ProofType,
  TeeConfig,
  UltrahonkConfig,
} from '../../config/index.js';
import {
  isGroth16Config,
  isPlonky2Config,
  isRisc0Config,
  isUltraplonkConfig,
  isUltrahonkConfig,
  isVersionedUltrahonkConfig,
  isVersionAtLeast,
  requireVersionAtLeast,
} from '../../utils/helpers/index.js';
import { RuntimeSpec } from '../../types.js';
import {
  RuntimeVersion,
  Risc0Version,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../enums.js';

/**
 * Validates the options provided for a given proof type.
 *
 * @param options - The proof options to validate.
 * @param runtimeSpec - Runtime spec for version-dependent validation.
 * @returns The validated options, with runtime-version defaults applied.
 * @throws {Error} - If validation fails.
 */
export function validateProofTypeOptions(
  options: ProofOptions,
  runtimeSpec: RuntimeSpec,
): ProofOptions {
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
      return options;

    case ProofType.plonky2:
      if (!isPlonky2Config(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'hashFunction' option.`,
        );
      }
      return options;

    case ProofType.risc0:
      if (!isRisc0Config(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'version' option.`,
        );
      }
      return options;

    case ProofType.ultraplonk:
      if (!isUltraplonkConfig(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'numberOfPublicInputs' option.`,
        );
      }
      return options;

    case ProofType.ultrahonk: {
      if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_0)) {
        const defaulted = withDefaultedUltrahonkVersion(options, runtimeSpec);

        if (!isVersionedUltrahonkConfig(defaulted)) {
          throw new Error(
            `Proof type '${proofType}' requires 'version' and 'variant' options for runtime version 1.6.0 or later.`,
          );
        }
        if (
          defaulted.config.version === UltrahonkVersion.V5_0 &&
          !isVersionAtLeast(runtimeSpec, RuntimeVersion.V2_1_0)
        ) {
          throw new Error(
            `Proof type '${proofType}' version '${UltrahonkVersion.V5_0}' is only available in runtime version 2.1.0 or later.`,
          );
        }
        return defaulted;
      }

      const config = options.config as UltrahonkConfig | undefined;

      if (config?.version !== undefined) {
        throw new Error(
          `Proof type '${proofType}' does not support a 'version' option before runtime version 1.6.0.`,
        );
      }

      if (!isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_3_0)) {
        return options;
      }

      if (!isUltrahonkConfig(options)) {
        throw new Error(
          `Proof type '${proofType}' requires a 'variant' option for runtime version 1.3.0 or later.`,
        );
      }
      return options;
    }

    case ProofType.ezkl:
      requireVersionAtLeast(
        runtimeSpec,
        RuntimeVersion.V1_3_0,
        'EZKL proof type',
      );
      return options;

    case ProofType.fflonk:
    case ProofType.sp1:
      return options;

    case ProofType.tee: {
      requireVersionAtLeast(
        runtimeSpec,
        RuntimeVersion.V1_5_0,
        'TEE proof type',
      );
      if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_0)) {
        return withDefaultedTeeVariant(options);
      }

      const config = options.config as TeeConfig | undefined;
      if (config?.variant !== undefined) {
        throw new Error(
          `Proof type '${proofType}' does not support a 'variant' option before runtime version 1.6.0.`,
        );
      }
      return options;
    }
    // ADD_NEW_PROOF_TYPE config validation per proof type
    // ADD RUNTIME SPECIFIC RULE IF NEEDED USING requireVersionAtLeast

    default:
      void (options as never);
      throw new Error(
        `Unsupported proof type: ${(options as { proofType: string }).proofType}`,
      );
  }
}

/** UltraHonk versions whose ZK variant the verifier rejects from runtime version 2.1.0. */
const DEPRECATED_ULTRAHONK_ZK_VERSIONS: ReadonlySet<UltrahonkVersion> = new Set(
  [UltrahonkVersion.V0_84, UltrahonkVersion.V3_0, UltrahonkVersion.Legacy],
);

/**
 * Rejects proof versions that the runtime still decodes but refuses to verify, so the
 * caller gets a clear error instead of paying fees for an `UnsupportedVersion` failure.
 * Applies to proof submission only: verification keys for these versions can still be
 * registered.
 *
 * @param options - Options already passed through `validateProofTypeOptions`.
 * @param runtimeSpec - Runtime spec for version-dependent validation.
 * @throws {Error} - If the runtime no longer verifies proofs of this version.
 */
export function rejectUnsupportedProofVersions(
  options: ProofOptions,
  runtimeSpec: RuntimeSpec,
): void {
  if (!isVersionAtLeast(runtimeSpec, RuntimeVersion.V2_1_0)) {
    return;
  }

  if (isRisc0Config(options) && options.config.version === Risc0Version.V2_1) {
    throw new Error(
      `Proof type '${ProofType.risc0}' version '${Risc0Version.V2_1}' is not supported from runtime version 2.1.0. Use '${Risc0Version.V2_2}' or later.`,
    );
  }

  if (
    isVersionedUltrahonkConfig(options) &&
    options.config.variant === UltrahonkVariant.ZK &&
    DEPRECATED_ULTRAHONK_ZK_VERSIONS.has(options.config.version)
  ) {
    throw new Error(
      `Proof type '${ProofType.ultrahonk}' variant '${UltrahonkVariant.ZK}' is not supported for version '${options.config.version}' from runtime version 2.1.0. Use version '${UltrahonkVersion.V5_0}' for ZK proofs.`,
    );
  }
}

/**
 * The UltraHonk version used when `version` is omitted: `V5_0` from runtime version 2.1.0,
 * `Legacy` from 1.6.1 and `V0_84` on 1.6.0. Callers relying on the `Legacy` default must pass
 * `version: UltrahonkVersion.Legacy` explicitly from runtime version 2.1.0.
 */
export function defaultUltrahonkVersion(
  runtimeSpec: RuntimeSpec,
): UltrahonkVersion {
  if (isVersionAtLeast(runtimeSpec, RuntimeVersion.V2_1_0)) {
    return UltrahonkVersion.V5_0;
  }
  return isVersionAtLeast(runtimeSpec, RuntimeVersion.V1_6_1)
    ? UltrahonkVersion.Legacy
    : UltrahonkVersion.V0_84;
}

function withDefaultedUltrahonkVersion(
  options: ProofOptions,
  runtimeSpec: RuntimeSpec,
): ProofOptions {
  const config = options.config as UltrahonkConfig | undefined;

  if (config?.variant === undefined || config.version !== undefined) {
    return options;
  }

  const defaultVersion = defaultUltrahonkVersion(runtimeSpec);

  console.warn(
    `zkverifyjs: Proof type '${ProofType.ultrahonk}' now supports versioned proofs on runtime version 1.6.0 or later. Defaulting missing 'version' to '${defaultVersion}'. Pass 'version' explicitly to silence this warning.`,
  );

  return {
    ...options,
    config: {
      ...config,
      version: defaultVersion,
    },
  };
}

function withDefaultedTeeVariant(options: ProofOptions): ProofOptions {
  const config = options.config as TeeConfig | undefined;

  if (config?.variant !== undefined) {
    return options;
  }

  console.warn(
    `zkverifyjs: Proof type '${ProofType.tee}' now supports variant verification keys on runtime version 1.6.0 or later. Defaulting missing 'variant' to '${TeeVariant.Intel}' for backwards compatibility. Pass 'variant' explicitly to silence this warning.`,
  );

  return {
    ...options,
    config: {
      ...config,
      variant: TeeVariant.Intel,
    },
  };
}
