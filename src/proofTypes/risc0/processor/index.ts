import { ProofProcessor } from '../../../types.js';
import { Risc0Vk, Risc0Pubs } from '../types.js';
import * as formatter from '../formatter/index.js';
import { ProofOptions } from '../../../config/index.js';
import { isRisc0Config } from '../../../utils/helpers/index.js';

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
