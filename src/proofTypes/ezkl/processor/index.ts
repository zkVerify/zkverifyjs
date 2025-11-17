import { ProofProcessor } from '../../../types';
import { EZKLPubs, EZKLVk } from '../types';
import * as formatter from '../formatter';

class EZKLProcessor implements ProofProcessor {
  formatProof(proof: string): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: EZKLVk['vk']): { vkBytes: string } {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: EZKLPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new EZKLProcessor();
