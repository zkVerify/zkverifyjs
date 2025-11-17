import { ApiPromise } from '@polkadot/api';
import { RuntimeSpec } from '../../../types';
import { RuntimeVersion } from '../../../enums';

/**
 * Fetches the runtime spec from the chain.
 * @param api - The ApiPromise instance.
 * @returns The runtime spec.
 */
export function fetchRuntimeVersion(api: ApiPromise): RuntimeSpec {
  const version = api.consts.system.version as unknown as {
    specVersion: { toNumber: () => number };
    specName: { toString: () => string };
  };
  return {
    specVersion: version.specVersion.toNumber(),
    specName: version.specName.toString(),
  };
}

export function isVersionAtLeast(
  runtimeSpec: RuntimeSpec,
  targetVersion: RuntimeVersion,
): boolean {
  return runtimeSpec.specVersion >= targetVersion;
}

export function isVersionBetween(
  runtimeSpec: RuntimeSpec,
  minVersion: RuntimeVersion,
  maxVersion: RuntimeVersion,
): boolean {
  return (
    runtimeSpec.specVersion >= minVersion &&
    runtimeSpec.specVersion <= maxVersion
  );
}

export function isVersionExactly(
  runtimeSpec: RuntimeSpec,
  targetVersion: RuntimeVersion,
): boolean {
  return runtimeSpec.specVersion === targetVersion;
}

export function requireVersionAtLeast(
  runtimeSpec: RuntimeSpec,
  targetVersion: RuntimeVersion,
  featureName: string,
): void {
  if (!isVersionAtLeast(runtimeSpec, targetVersion)) {
    throw new Error(
      `${featureName} is only available in runtime version ${targetVersion} or later`,
    );
  }
}
