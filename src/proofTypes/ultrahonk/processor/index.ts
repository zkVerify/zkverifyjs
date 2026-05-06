import { ProofProcessor } from '../../../types';
import {
  UltraHonkVk,
  UltraHonkPubs,
  UltraHonkProof,
  VariantUltraHonkProof,
  VersionedUltraHonkProof,
  VersionedUltraHonkVk,
} from '../types';
import * as formatter from '../formatter';
import { ProofOptions, UltrahonkConfig } from '../../../config';
import {
  isUltrahonkConfig,
  isVersionedUltrahonkConfig,
} from '../../../utils/helpers';

class UltraHonkProcessor implements ProofProcessor {
  formatProof(
    proof: UltraHonkProof['proof'],
    options: ProofOptions,
  ): string | VariantUltraHonkProof | VersionedUltraHonkProof {
    const config = options.config as UltrahonkConfig | undefined;

    if (config?.version !== undefined && !isVersionedUltrahonkConfig(options)) {
      throw new Error(
        'Invalid proof options: expected UltrahonkConfig with version and variant',
      );
    }

    const formattedProof = formatter.formatProof(proof);

    if (isVersionedUltrahonkConfig(options)) {
      return {
        [options.config.version]: {
          [options.config.variant]: formattedProof,
        },
      };
    }

    if (isUltrahonkConfig(options)) {
      return { [options.config.variant]: formattedProof };
    }

    return formattedProof;
  }

  formatVk(
    vk: UltraHonkVk['vk'],
    options: ProofOptions,
  ): string | VersionedUltraHonkVk {
    const config = options.config as UltrahonkConfig | undefined;

    if (config?.version !== undefined && !isVersionedUltrahonkConfig(options)) {
      throw new Error(
        'Invalid proof options: expected UltrahonkConfig with version and variant',
      );
    }

    const formattedVk = formatter.formatVk(vk);

    if (!isVersionedUltrahonkConfig(options)) {
      return formattedVk;
    }

    return { [options.config.version]: formattedVk };
  }

  formatPubs(pubs: UltraHonkPubs['pubs']): string[] {
    return formatter.formatPubs(pubs);
  }
}

export default new UltraHonkProcessor();
