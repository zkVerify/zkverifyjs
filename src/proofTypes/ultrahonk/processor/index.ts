import { ProofProcessor } from '../../../types';
import { UltraHonkVk, UltraHonkPubs, UltraHonkProof } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isUltrahonkConfig } from '../../../utils/helpers';

class UltraHonkProcessor implements ProofProcessor {
  formatProof(
    proof: UltraHonkProof['proof'],
    options: ProofOptions,
  ): Record<string, string> | string {
    const formattedProof = formatter.formatProof(proof);

    if (isUltrahonkConfig(options)) {
      return { [options.config.variant]: formattedProof };
    }

    return formattedProof;
  }

  formatVk(vk: UltraHonkVk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new UltraHonkProcessor();
