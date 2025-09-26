import { ProofType, SupportedNetwork } from './config';
import {
  AggregateSecurityRules,
  Destination,
  TransactionStatus,
  ZkVerifyEvents,
} from './enums';
import { NewAggregationEventSubscriptionOptions } from './api/aggregation/types';

export interface ProofProcessor {
  formatProof(proof: unknown, options?: unknown): unknown;
  formatVk(vkJson: unknown, options?: unknown): unknown;
  formatPubs(pubs: unknown, options?: unknown): unknown;
}

export interface ProofData {
  proof: unknown;
  publicSignals?: unknown;
  vk?: unknown;
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

export interface BatchVerifyTransactionInfo extends TransactionInfo {
  proofType: ProofType;
  batchCount: number;
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

export interface AggregateTransactionInfo extends TransactionInfo {
  domainId: number | undefined;
  aggregationId: number | undefined;
  receipt: string;
}

export interface AccountInfo {
  address: string;
  nonce: number;
  freeBalance: string;
  reservedBalance: string;
}

export interface NewAggregationReceipt {
  blockHash: string;
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
  network?: SupportedNetwork | '';
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

export interface NewAggregationReceiptEvent {
  event: ZkVerifyEvents;
  blockHash: string;
  data: {
    domainId?: string;
    aggregationId?: string;
    receipt?: string;
  };
  phase: string;
}

export interface AggregateStatementPathResult {
  root: string;
  proof: string[];
  numberOfLeaves: number;
  leafIndex: number;
  leaf: string;
}

export interface SubscriptionEntry {
  event: ZkVerifyEvents;
  callback?: (data: unknown) => void;
  options?: NewAggregationEventSubscriptionOptions | undefined;
}

export const OptimisticVerificationResultType = {
  Ok: 'ok',
  ValidityError: 'validity_error',
  DispatchError: 'dispatch_error',
  UnknownError: 'unknown_error',
  TransportError: 'transport_error',
  Exception: 'exception',
} as const;

export type OptimisticVerificationResultType =
  (typeof OptimisticVerificationResultType)[keyof typeof OptimisticVerificationResultType];

export type OptimisticVerifyResult = {
  success: boolean;
  type: OptimisticVerificationResultType;
  message: string;
  code?: string;
  verificationError?: boolean;
  failedIndex?: number;
};

export type TransactionValidityError = {
  isInvalid: boolean;
  isUnknown: boolean;
  asInvalid: { type: string };
  asUnknown: { type: string };
  toString: () => string;
};

export type ExtendedDispatchError = {
  isTransactional?: boolean;
  asTransactional?: { type: string };
  isUnavailable?: boolean;
  isExhausted?: boolean;
  isCorruption?: boolean;
};
