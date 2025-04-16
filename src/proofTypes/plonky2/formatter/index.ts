import { Plonky2Proof, Plonky2Pubs, Plonky2Vk } from '../types';
import { ProofOptions } from '../../../config';
import { isPlonky2Config } from '../../../utils/helpers';

export function formatProof(
  proof: Plonky2Proof['proof'],
  options: ProofOptions,
): { compressed: boolean; bytes: string } {
  validatedHexString(proof);

  if (isPlonky2Config(options)) {
    return {
      compressed: options.config.compressed,
      bytes: proof,
    };
  }

  throwInvalidPlonky2Config();
}

export function formatVk(
  vk: Plonky2Vk['vk'],
  options: ProofOptions,
): { config: string; bytes: string } {
  validatedHexString(vk);

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
  validatedHexString(pubs);

  if (isPlonky2Config(options)) {
    return pubs;
  }

  throwInvalidPlonky2Config();
}

function validatedHexString(input: string): void {
  if (!input.startsWith('0x')) {
    throw new Error('Invalid format: string input must be 0x-prefixed.');
  }
}

function throwInvalidPlonky2Config(): never {
  throw new Error('Invalid config: Not a Plonky2 proof config');
}
