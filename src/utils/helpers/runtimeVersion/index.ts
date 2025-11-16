import { ApiPromise } from '@polkadot/api';
import { LastRuntimeUpgrade } from '../../../types';
import { RuntimeVersion } from '../../../enums';

/**
 * Fetches the runtime version from the chain.
 * @param api - The ApiPromise instance.
 * @returns The runtime version.
 */
export function fetchRuntimeVersion(api: ApiPromise): LastRuntimeUpgrade {
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
  runtimeVersion: LastRuntimeUpgrade,
  targetVersion: RuntimeVersion,
): boolean {
  return runtimeVersion.specVersion >= targetVersion;
}

export function isVersionBetween(
  runtimeVersion: LastRuntimeUpgrade,
  minVersion: RuntimeVersion,
  maxVersion: RuntimeVersion,
): boolean {
  return (
    runtimeVersion.specVersion >= minVersion &&
    runtimeVersion.specVersion <= maxVersion
  );
}

export function isVersionExactly(
  runtimeVersion: LastRuntimeUpgrade,
  targetVersion: RuntimeVersion,
): boolean {
  return runtimeVersion.specVersion === targetVersion;
}

export function requireVersionAtLeast(
  runtimeVersion: LastRuntimeUpgrade,
  targetVersion: RuntimeVersion,
  featureName: string,
): void {
  if (!isVersionAtLeast(runtimeVersion, targetVersion)) {
    throw new Error(
      `${featureName} is only available in runtime version ${targetVersion} or later`,
    );
  }
}
