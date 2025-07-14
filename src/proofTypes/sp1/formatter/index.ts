import { SP1Proof, SP1Vk, SP1Pubs } from '../types';

export function formatProof(proof: SP1Proof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: SP1Vk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: SP1Pubs['pubs']): string {
  return validateHexString(pubs);
}

function validateHexString(input: string): string {
  if (!input.startsWith('0x')) {
    throw new Error('Invalid format: string input must be 0x-prefixed.');
  }
  return input;
}
