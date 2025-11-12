import { LastRuntimeUpgrade } from '../types';
import { RuntimeVersion } from '../enums';

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
