import {
  Groth16Config,
  Plonky2Config,
  ProofOptions,
  Risc0Config,
} from '../config';

import { BatchOptimisticVerificationBuilder } from './builders/batchOptimisticVerify';
import { BatchVerificationBuilder } from './builders/batchVerify';
import { NetworkConfig } from '../types';
import { OptimisticVerificationBuilder } from './builders/optimisticVerify';
import { RegisterKeyBuilder } from './builders/register';
import { VerificationBuilder } from './builders/verify';

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

type GenericProofMethodMap<TBuilder> = {
  groth16: (options: Groth16Config) => TBuilder;
  plonky2: (options: Plonky2Config) => TBuilder;
  risc0: (options: Risc0Config) => TBuilder;
  ultraplonk: () => TBuilder;
  proofofsql: () => TBuilder;
  fflonk: () => TBuilder;
  // ADD_NEW_PROOF_TYPE
};

export type ProofMethodMap = GenericProofMethodMap<VerificationBuilder>;
export type OptimisticProofMethodMap =
  GenericProofMethodMap<OptimisticVerificationBuilder>;
export type BatchProofMethodMap =
  GenericProofMethodMap<BatchVerificationBuilder>;
export type BatchOptimisticProofMethodMap =
  GenericProofMethodMap<BatchOptimisticVerificationBuilder>;
export type RegisterKeyMethodMap = GenericProofMethodMap<RegisterKeyBuilder>;
