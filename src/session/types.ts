import { CurveType, Library, ProofType } from '../config';
import { NetworkConfig } from '../types';

export interface zkVerifySessionOptions {
  networkConfig: NetworkConfig;
  seedPhrases?: string[];
  wallet?: WalletOptions;
}

export interface WalletOptions {
  source: string;
  accountAddress: string;
}

export interface VerifyOptions {
  proofOptions: ProofOptions;
  accountAddress?: string;
  nonce?: number;
  registeredVk?: boolean;
  domainId?: number;
}

export interface ProofOptions {
  proofType: ProofType;
  library?: Library;
  curve?: CurveType;
}
