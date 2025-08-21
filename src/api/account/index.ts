import { Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { encodeAddress } from '@polkadot/util-crypto';
import { CHAIN_SS58_PREFIX } from '../../config';

/**
 * Sets up the account using the provided secret seed phrase.
 *
 * @param {string} secretSeedPhrase - The secret seed phrase used to create the account.
 * @returns {KeyringPair} The initialized account.
 * @throws Will throw an error if the seed phrase is invalid.
 */
export const setupAccount = (secretSeedPhrase: string): KeyringPair => {
  try {
    const keyring = new Keyring({ type: 'sr25519' });
    keyring.setSS58Format(CHAIN_SS58_PREFIX);

    return keyring.addFromUri(secretSeedPhrase);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid seed phrase provided: ${error.message}`);
    } else {
      throw new Error(
        'An unknown error occurred while setting up the account.',
      );
    }
  }
};

/** Canonical SS58 address for a pair/public key (fixed to chain prefix). */
export const canonicalAddress = (
  pairOrPublicKey: KeyringPair | Uint8Array,
): string => {
  const pk =
    pairOrPublicKey instanceof Uint8Array
      ? pairOrPublicKey
      : pairOrPublicKey.publicKey;
  return encodeAddress(pk, CHAIN_SS58_PREFIX);
};

/**
 * Derives a hard child account at `//{index}` from `base`.
 * Returns the derived keypair, its SS58-encoded address (using `CHAIN_SS58_PREFIX`), and the derivation path.
 *
 * @param {KeyringPair} base - The base sr25519 keypair to derive from.
 * @param {number} index - The child index to derive at (hard path `//index`, appended to any existing path on `base`).
 * @returns {{ pair: KeyringPair, address: string, path: string }} The derived `pair`, its SS58 `address`, and the `path`.
 * @throws {Error} If derivation fails.
 */
export const deriveChildAt = (
  base: KeyringPair,
  index: number,
): { pair: KeyringPair; address: string; path: string } => {
  const path = `//${index}`;
  try {
    const pair = base.derive(path);
    const address = encodeAddress(pair.publicKey, CHAIN_SS58_PREFIX);
    return { pair, address, path };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to derive child at ${path}: ${msg}`);
  }
};
