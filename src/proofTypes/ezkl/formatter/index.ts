import { EZKLProof, EZKLVk, EZKLPubs } from '../types';

export function formatProof(proof: EZKLProof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: EZKLVk['vk']): { vkBytes: string } {
  if (typeof vk !== 'object' || vk === null || !('vkBytes' in vk)) {
    throw new Error(
      'Invalid EZKL VK format: expected object with vkBytes property',
    );
  }

  const vkBytes = validateHexString(vk.vkBytes);

  return { vkBytes };
}

export function formatPubs(pubs: EZKLPubs['pubs']): string[] {
  return pubs.map(validateHexString);
}

function validateHexString(input: string): string {
  if (!input.startsWith('0x')) {
    throw new Error('Invalid format: string input must be 0x-prefixed.');
  }
  return input;
}
