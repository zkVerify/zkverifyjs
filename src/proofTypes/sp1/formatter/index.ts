import { SP1Proof, SP1Vk, SP1Pubs } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';

export function formatProof(proof: SP1Proof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: SP1Vk['vk']): string {
  return validateHexString(vk);
}

export function formatPubs(pubs: SP1Pubs['pubs']): string {
  return validateHexString(pubs);
}
