import { ProofProcessor } from '../../../types';
import { Risc0Vk, Risc0Pubs } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isRisc0Config } from '../../../utils/helpers';

class Risc0Processor implements ProofProcessor {
  formatProof(proof: string, options: ProofOptions): Record<string, string> {
    if (!isRisc0Config(options)) {
      throw new Error(
        'Invalid proof options: expected Risc0Config with version',
      );
    }

    const formattedProof = formatter.formatProof(proof);
    return { [options.config.version]: formattedProof };
  }

  formatVk(vk: Risc0Vk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: Risc0Pubs['pubs']): string {
    return formatter.formatPubs(pubs);
  }
}

export default new Risc0Processor();
