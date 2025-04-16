import { ProofProcessor } from '../../../types';
import { Risc0Vk, Risc0Pubs } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';

class Risc0Processor implements ProofProcessor {
  formatProof(
    proof: string,
    options: ProofOptions,
    version: string,
  ): Record<string, string> {
    const formattedProof = formatter.formatProof(proof);
    return { [version]: formattedProof };
  }

  formatVk(vk: Risc0Vk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: Risc0Pubs['pubs']): string {
    return formatter.formatPubs(pubs);
  }
}

export default new Risc0Processor();
