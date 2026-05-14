import { ProofProcessor } from '../../../types.js';
import { TeeVk, VariantTeeVk } from '../types.js';
import * as formatter from '../formatter/index.js';
import { ProofOptions } from '../../../config/index.js';
import { isTeeConfig } from '../../../utils/helpers/index.js';

class TEEProcessor implements ProofProcessor {
  formatProof(proof: string): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: TeeVk['vk'], options: ProofOptions): TeeVk['vk'] | VariantTeeVk {
    if (!isTeeConfig(options)) {
      return formatter.formatVk(vk);
    }

    return { [options.config.variant]: formatter.formatIntelVk(vk) };
  }

  formatPubs(): string {
    return formatter.formatPubs();
  }
}

export default new TEEProcessor();
