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
 * @returns The runtime version.
 * @throws Will throw an error if runtime version cannot be fetched.
 */
export async function fetchRuntimeVersion(
  api: ApiPromise,
): Promise<LastRuntimeUpgrade> {
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

    throw new Error('Runtime version is not available on this chain');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch runtime version: ${error.message}`);
    }
    throw new Error('Failed to fetch runtime version due to an unknown error');
  }
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
      `${featureName} is only available in runtime version 1.3.0 or later`,
    );
  }
}
