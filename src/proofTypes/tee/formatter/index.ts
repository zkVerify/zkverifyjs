import { TeeIntelVk, TeeProof, TeeVk } from '../types.js';
import { validateHexString } from '../../../utils/helpers/index.js';

export function formatProof(proof: TeeProof['proof']): string {
  return validateHexString(proof);
}

export function formatVk(vk: TeeVk['vk']): TeeVk['vk'] {
  if (typeof vk !== 'object' || vk === null) {
    throw new Error(
      'Invalid TEE VK format: expected object with tcbResponse and certificates properties',
    );
  }

  if (!('tcbResponse' in vk) || !('certificates' in vk)) {
    throw new Error(
      'Invalid TEE VK format: expected object with tcbResponse and certificates properties',
    );
  }

  const tcbResponse = validateHexString(vk.tcbResponse);
  const certificates = validateHexString(vk.certificates);

  return { tcbResponse, certificates };
}

export function formatIntelVk(vk: TeeVk['vk']): TeeIntelVk {
  const { tcbResponse, certificates } = formatVk(vk);

  return { tcb_response: tcbResponse, certificates };
}

export function formatPubs(): string {
  return '0x';
}
