import { Risc0Proof, Risc0Vk, Risc0Pubs } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';

export function formatProof(proof: Risc0Proof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: Risc0Vk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: Risc0Pubs['pubs']): string {
  return validateHexString(pubs);
}
