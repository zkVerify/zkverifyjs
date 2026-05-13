import * as formatter from '../formatter/index.js';

import {
  FflonkProof,
  FflonkPublicSignals,
  FflonkVerificationKey,
} from '../types.js';

import { ProofProcessor } from '../../../types.js';

class FflonkProcessor implements ProofProcessor {
  formatProof(proof: FflonkProof): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: FflonkVerificationKey): FflonkVerificationKey {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: FflonkPublicSignals): string {
    return formatter.formatPubs(pubs);
  }
}

export default new FflonkProcessor();
