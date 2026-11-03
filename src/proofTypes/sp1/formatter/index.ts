import { SP1Proof, SP1Vk, SP1Pubs } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';

export function formatProof(proof: SP1Proof['proof']): string {
  return validateHexString(proof);
}

/** The BabyBear field modulus. */
const BABY_BEAR_P = 0x78000001;

/**
 * Validates an SP1 VK: 32 bytes whose 4-byte big-endian words are each a canonical BabyBear
 * element, as the runtime requires.
 */
export function formatVk(vk: SP1Vk['vk']): string {
  validateHexString(vk);
  if (vk.length !== 2 + 32 * 2) {
    throw new Error('SP1 VK must be exactly 32 bytes.');
  }
  for (let i = 2; i < vk.length; i += 8) {
    if (parseInt(vk.slice(i, i + 8), 16) >= BABY_BEAR_P) {
      throw new Error(
        'SP1 VK is not a canonical BabyBear digest: every 4-byte word must be below 0x78000001.',
      );
    }
  }
  return vk;
}

export function formatPubs(pubs: SP1Pubs['pubs']): string {
  return validateHexString(pubs);
}
