import { ProofProcessor } from '../../../types';
import { UltraPlonkProof, UltraPlonkVk, UltraPlonkPubs } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';

class SP1Processor implements ProofProcessor {
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

export default new SP1Processor();
