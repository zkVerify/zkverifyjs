import { Plonky2Proof, Plonky2Pubs, Plonky2Vk } from '../types.js';
import { ProofOptions } from '../../../config/index.js';
import {
  isPlonky2Config,
  validateHexString,
} from '../../../utils/helpers/index.js';

export function formatProof(
  proof: Plonky2Proof['proof'],
  options: ProofOptions,
): { bytes: string } {
  validateHexString(proof);

  if (isPlonky2Config(options)) {
    return {
      bytes: proof,
    };
  }

  throwInvalidPlonky2Config();
}

export function formatVk(
  vk: Plonky2Vk['vk'],
  options: ProofOptions,
): { config: string; bytes: string } {
  validateHexString(vk);

  if (isPlonky2Config(options)) {
    return {
      config: options.config.hashFunction,
      bytes: vk,
    };
  }

  throwInvalidPlonky2Config();
}

export function formatPubs(
  pubs: Plonky2Pubs['pubs'],
  options: ProofOptions,
): string {
  validateHexString(pubs);

  if (isPlonky2Config(options)) {
    return pubs;
  }

  throwInvalidPlonky2Config();
}

function throwInvalidPlonky2Config(): never {
  throw new Error('Invalid config: Not a Plonky2 proof config');
}
