import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';

export function formatProof(proof: UltraHonkProof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: UltraHonkVk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
  return pubs.map(validateHexString);
}
