import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';
import { requireCanonical } from '../../groth16/formatter/utils.js';

/** The BN254 scalar field modulus. */
const FR_MODULUS =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

/** Public inputs are 32-byte big-endian field elements. */
const PUB_HEX_LENGTH = 2 + 32 * 2;

export function formatProof(proof: UltraHonkProof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: UltraHonkVk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
  return pubs.map((pub) => {
    validateHexString(pub);
    if (pub.length !== PUB_HEX_LENGTH) {
      throw new Error('Public input must be exactly 32 bytes.');
    }
    // The runtime rejects non-canonical public inputs: `v + r` would attest the same
    // statement as `v` under a different statement hash.
    requireCanonical(BigInt(pub), FR_MODULUS, 'Public input');
    return pub;
  });
}
