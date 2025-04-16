import {
  Groth16Config,
  Plonky2Config,
  ProofOptions,
  Risc0Config,
} from '../config';
import { NetworkConfig } from '../types';
import { VerificationBuilder } from './builders/verify';
import { OptimisticVerificationBuilder } from './builders/optimisticVerify';
import { RegisterKeyBuilder } from './builders/register';

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
  // ADD_NEW_PROOF_TYPE
};

export type ProofMethodMap = GenericProofMethodMap<VerificationBuilder>;
export type OptimisticProofMethodMap =
  GenericProofMethodMap<OptimisticVerificationBuilder>;
export type RegisterKeyMethodMap = GenericProofMethodMap<RegisterKeyBuilder>;
