import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types';

export function formatProof(proof: UltraHonkProof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: UltraHonkVk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: UltraHonkPubs['pubs']): string {
  return validateHexString(pubs);
}

function validateHexString(input: string): string {
  if (!input.startsWith('0x')) {
    throw new Error('Invalid format: string input must be 0x-prefixed.');
  }
  return input;
}
