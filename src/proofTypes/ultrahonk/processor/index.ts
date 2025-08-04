import { ProofProcessor } from '../../../types';
import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types';
import * as formatter from '../formatter';

class UltraHonkProcessor implements ProofProcessor {
  formatProof(proof: UltraHonkProof['proof']): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: UltraHonkVk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new UltraHonkProcessor();
