import { ProofType } from './config';
import { TransactionStatus } from './enums';

export interface ProofProcessor {
  formatProof(proof: unknown, options?: unknown, version?: string): unknown;
  formatVk(vkJson: unknown, options?: unknown): unknown;
  formatPubs(pubs: unknown, options?: unknown): unknown;
}

export interface ProofData {
  proof: unknown;
  publicSignals: unknown;
  vk?: unknown;
  version?: string;
}

export interface TransactionInfo {
  blockHash: string;
  status: TransactionStatus;
  txHash?: string;
  extrinsicIndex?: number;
  feeInfo?: {
    payer: string;
    actualFee: string;
    tip: string;
    paysFee: string;
  };
  weightInfo?: {
    refTime?: string;
    proofSize?: string;
  };
  txClass?: string;
}

export interface VerifyTransactionInfo extends TransactionInfo {
  proofType: ProofType;
  attestationId: number | undefined;
  leafDigest: string | null;
  attestationConfirmed: boolean;
  attestationEvent?: AttestationEvent;
}

export interface VKRegistrationTransactionInfo extends TransactionInfo {
  proofType: ProofType;
  statementHash?: string;
}

export interface RegisterDomainTransactionInfo extends TransactionInfo {
  domainId: number | undefined;
}

export interface DomainTransactionInfo extends TransactionInfo {
  domainId: number | undefined;
  domainState: string;
}

export interface AccountInfo {
  address: string;
  nonce: number;
  freeBalance: string;
  reservedBalance: string;
}

export interface AttestationEvent {
  id: number;
  attestation: string;
}

export interface MerkleProof {
  root: string;
  proof: string[];
  numberOfLeaves: number;
  leafIndex: number;
  leaf: string;
}
