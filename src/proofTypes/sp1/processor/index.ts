import { ProofProcessor } from '../../../types';
import { SP1Pubs, SP1Vk } from '../types';
import * as formatter from '../formatter';

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
