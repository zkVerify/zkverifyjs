import { ProofProcessor } from '../../../types.js';
import { Plonky2Proof, Plonky2Vk, Plonky2Pubs } from '../types.js';
import * as formatter from '../formatter/index.js';
import { ProofOptions } from '../../../config/index.js';

class Plonky2Processor implements ProofProcessor {
  formatProof(
    proof: Plonky2Proof['proof'],
    options: ProofOptions,
  ): { bytes: string } {
    return formatter.formatProof(proof, options);
  }

  formatVk(
    vk: Plonky2Vk['vk'],
    options: ProofOptions,
  ): { config: string; bytes: string } {
    return formatter.formatVk(vk, options);
  }

  formatPubs(pubs: Plonky2Pubs['pubs'], options: ProofOptions): string {
    return formatter.formatPubs(pubs, options);
  }
}

export default new Plonky2Processor();
