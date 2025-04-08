import { ProofProcessor } from '../../../types';
import { Plonky2Proof, Plonky2Vk, Plonky2Pubs } from '../types';
import * as formatter from '../formatter';

class ProofOfSqlProcessor implements ProofProcessor {
  formatProof(proof: Plonky2Proof['proof']): string {
    return formatter.formatProof(proof);
  }

  formatVk(vk: Plonky2Vk['vk']): string {
    return formatter.formatVk(vk);
  }

  formatPubs(pubs: Plonky2Pubs['pubs']): string {
    return formatter.formatPubs(pubs);
  }
}

export default new ProofOfSqlProcessor();
