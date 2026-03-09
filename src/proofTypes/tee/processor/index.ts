import { ProofProcessor } from '../../../types';
import { TeeVk } from '../types';
import * as formatter from '../formatter';

class TEEProcessor implements ProofProcessor {
  formatProof(proof: string): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: TeeVk['vk']): { tcbResponse: string; certificates: string } {
    return formatter.formatVk(vk);
  }

  formatPubs(): string {
    return formatter.formatPubs();
  }
}

export default new TEEProcessor();
