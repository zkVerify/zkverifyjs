import { Plonky2Proof, Plonky2Pubs, Plonky2Vk } from '../types';

export function formatProof(proof: Plonky2Proof['proof']): string {
  return validatedHexString(proof);
}

export function formatVk(vk: Plonky2Vk['vk']): string {
  return validatedHexString(vk);
}

export function formatPubs(pubs: Plonky2Pubs['pubs']): string {
  return validatedHexString(pubs);
}

function validatedHexString(input: string): string {
  if (!input.startsWith('0x')) {
    throw new Error('Invalid format: string input must be 0x-prefixed.');
  }
  return input;
}
