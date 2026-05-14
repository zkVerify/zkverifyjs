import { ProofProcessor } from '../../../types.js';
import { SP1Pubs, SP1Vk } from '../types.js';
import * as formatter from '../formatter/index.js';

class SP1Processor implements ProofProcessor {
  formatProof(proof: string): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: SP1Vk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: SP1Pubs['pubs']): string {
    return formatter.formatPubs(pubs);
  }
}

export default new SP1Processor();
