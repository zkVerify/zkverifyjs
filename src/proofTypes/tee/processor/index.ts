import { ProofProcessor } from '../../../types';
import { TeeVk, VariantTeeVk } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isTeeConfig } from '../../../utils/helpers';

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
