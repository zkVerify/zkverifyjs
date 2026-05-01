import { ProofProcessor } from '../../../types';
import { TeeVk, VariantTeeVk } from '../types';
import * as formatter from '../formatter';
import { ProofOptions } from '../../../config';
import { isTeeConfig } from '../../../utils/helpers';

class TEEProcessor implements ProofProcessor {
  formatProof(proof: string): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: TeeVk['vk'], options: ProofOptions): VariantTeeVk {
    if (!isTeeConfig(options)) {
      throw new Error('Invalid proof options: expected TeeConfig with variant');
    }

    return { [options.config.variant]: formatter.formatVk(vk) };
  }

  formatPubs(): string {
    return formatter.formatPubs();
  }
}

export default new TEEProcessor();
