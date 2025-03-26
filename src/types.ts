import { ProofType, SupportedNetwork } from './config';
import {
  AggregateSecurityRules,
  Destination,
  TransactionStatus,
} from './enums';

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
  domainId: number | undefined;
  aggregationId: number | undefined;
  statement: string | null;
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

export interface NewAggregationReceipt {
  domainId: number;
  aggregationId: number;
  receipt: string;
}

export interface MerkleProof {
  root: string;
  proof: string[];
  numberOfLeaves: number;
  leafIndex: number;
  leaf: string;
}

export type NetworkConfig = {
  host: SupportedNetwork;
  websocket: string;
  rpc: string;
};

export type CustomNetworkConfig = Omit<NetworkConfig, 'host'>;

export type DeliveryInput = {
  price: number;
  destinationChain: { Evm: number };
  destination_module: string;
  timeout: number;
};

export type DomainOptions =
  | {
      destination: Destination.None;
      deliveryOwner?: string;
      aggregateRules: AggregateSecurityRules;
    }
  | {
      destination: Destination.Hyperbridge;
      deliveryInput: DeliveryInput;
      deliveryOwner?: string;
      aggregateRules: AggregateSecurityRules;
    };

export type Delivery =
  | { None: null }
  | {
      destination: {
        Hyperbridge: {
          destinationChain: {
            Evm: number;
          };
          destination_module: string;
          timeout: number;
        };
      };
      price: number;
    };
