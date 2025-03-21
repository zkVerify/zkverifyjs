import { CurveType, Library, ProofType, SupportedNetwork } from '../config';

export interface zkVerifySessionOptions {
  host: SupportedNetwork;
  seedPhrases?: string[];
  customWsUrl?: string;
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
  waitForNewAttestationEvent?: boolean;
  registeredVk?: boolean;
  domainId?: number;
}

export interface ProofOptions {
  proofType: ProofType;
  library?: Library;
  curve?: CurveType;
}
