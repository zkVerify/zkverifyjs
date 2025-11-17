import { ProofProcessor } from '../../../types';
import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isUltrahonkConfig } from '../../../utils/helpers';

class UltraHonkProcessor implements ProofProcessor {
  formatProof(
    proof: UltraHonkProof['proof'],
    options: ProofOptions,
  ): Record<string, string> {
    if (!isUltrahonkConfig(options)) {
      throw new Error(
        'Invalid proof options: expected UltrahonkConfig with variant',
      );
    }

    const formattedProof = formatter.formatProof(proof);
    return { [options.config.variant]: formattedProof };
  }

  formatVk(vk: UltraHonkVk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new UltraHonkProcessor();
