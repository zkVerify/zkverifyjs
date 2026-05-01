import { ProofProcessor } from '../../../types';
import {
  UltraHonkVk,
  UltraHonkPubs,
  UltraHonkProof,
  VersionedUltraHonkProof,
  VersionedUltraHonkVk,
} from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isUltrahonkConfig } from '../../../utils/helpers';

class UltraHonkProcessor implements ProofProcessor {
  formatProof(
    proof: UltraHonkProof['proof'],
    options: ProofOptions,
  ): VersionedUltraHonkProof {
    if (!isUltrahonkConfig(options)) {
      throw new Error(
        'Invalid proof options: expected UltrahonkConfig with version and variant',
      );
    }

    const formattedProof = formatter.formatProof(proof);

    return {
      [options.config.version]: {
        [options.config.variant]: formattedProof,
      },
    };
  }

  formatVk(vk: UltraHonkVk['vk'], options: ProofOptions): VersionedUltraHonkVk {
    if (!isUltrahonkConfig(options)) {
      throw new Error(
        'Invalid proof options: expected UltrahonkConfig with version and variant',
      );
    }

    return { [options.config.version]: formatter.formatVk(vk) };
  }

  formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new UltraHonkProcessor();
