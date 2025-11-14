import { ApiPromise } from '@polkadot/api';
import { LastRuntimeUpgrade } from '../../../types';
import { RuntimeVersion } from '../../../enums';

interface OptionLike<T> {
  isSome: boolean;
  unwrap: () => T;
}

interface RuntimeUpgradeInfo {
  specVersion: { toNumber: () => number };
  specName: { toString: () => string };
}

/**
 * Fetches the runtime version from the chain.
 * @param api - The ApiPromise instance.
 * @returns The runtime version, or null if it cannot be fetched.
 */
export async function fetchRuntimeVersion(
  api: ApiPromise,
): Promise<LastRuntimeUpgrade | null> {
  try {
    const lastUpgrade = await api.query.system.lastRuntimeUpgrade();
    const optionUpgrade =
      lastUpgrade as unknown as OptionLike<RuntimeUpgradeInfo>;

    if (optionUpgrade.isSome) {
      const upgrade = optionUpgrade.unwrap();
      return {
        specVersion: upgrade.specVersion.toNumber(),
        specName: upgrade.specName.toString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function isVersionAtLeast(
  runtimeVersion: LastRuntimeUpgrade | null,
  targetVersion: RuntimeVersion,
): boolean {
  if (!runtimeVersion) {
    return false;
  }
  return runtimeVersion.specVersion >= targetVersion;
}

export function isVersionBetween(
  runtimeVersion: LastRuntimeUpgrade | null,
  minVersion: RuntimeVersion,
  maxVersion: RuntimeVersion,
): boolean {
  if (!runtimeVersion) {
    return false;
  }
  return (
    runtimeVersion.specVersion >= minVersion &&
    runtimeVersion.specVersion <= maxVersion
  );
}

export function isVersionExactly(
  runtimeVersion: LastRuntimeUpgrade | null,
  targetVersion: RuntimeVersion,
): boolean {
  if (!runtimeVersion) {
    return false;
  }
  return runtimeVersion.specVersion === targetVersion;
}

export function requireVersionAtLeast(
  runtimeVersion: LastRuntimeUpgrade | null,
  targetVersion: RuntimeVersion,
  featureName: string,
): void {
  if (!runtimeVersion) {
    throw new Error(
      `Runtime version is not available. ${featureName} requires runtime version ${targetVersion} or later.`,
    );
  }
  if (!isVersionAtLeast(runtimeVersion, targetVersion)) {
    throw new Error(
      `${featureName} is only available in runtime version ${targetVersion} or later`,
    );
  }
}
