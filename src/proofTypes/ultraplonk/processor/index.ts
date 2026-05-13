import { ProofProcessor } from '../../../types.js';
import { UltraPlonkProof, UltraPlonkVk, UltraPlonkPubs } from '../types.js';
import * as formatter from '../formatter/index.js';
import { ProofOptions } from '../../../config/index.js';

class UltraPlonkProcessor implements ProofProcessor {
  formatProof(
    proof: UltraPlonkProof['proof'],
    options: ProofOptions,
  ): {
    proof: string;
    publicSignals: string[];
  } {
    return formatter.formatProof(proof, options);
  }

  formatVk(vk: UltraPlonkVk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: UltraPlonkPubs['pubs'], options: ProofOptions): string[] {
    return formatter.formatPubs(pubs, options);
  }
}

export default new UltraPlonkProcessor();
