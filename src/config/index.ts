import { ProofProcessor } from '../types';
import {
  Groth16Processor,
  ProofOfSqlProcessor,
  Risc0Processor,
  UltraPlonkProcessor,
} from '../proofTypes';
import { Risc0Version } from '../enums';

export enum SupportedNetwork {
  Volta = 'wss://volta-rpc.zkverify.io',
  Custom = 'custom',
  Testnet = 'wss://testnet-rpc.zkverify.io',
  // ADD_NEW_SUPPORTED_NETWORK
}

export enum ProofType {
  groth16 = 'groth16',
  risc0 = 'risc0',
  ultraplonk = 'ultraplonk',
  proofofsql = 'proofofsql',
  // ADD_NEW_PROOF_TYPE
}

export enum Library {
  snarkjs = 'snarkjs',
  gnark = 'gnark',
}

export enum CurveType {
  bn128 = 'bn128',
  bn254 = 'bn254',
  bls12381 = 'bls12381',
}

interface ProofConfig {
  pallet: string;
  processor: ProofProcessor;
  supportedVersions: string[];
  requiresLibrary?: boolean;
  requiresCurve?: boolean;
}

export const proofConfigurations: Record<ProofType, ProofConfig> = {
  [ProofType.groth16]: {
    pallet: 'settlementGroth16Pallet',
    processor: Groth16Processor,
    supportedVersions: [],
    requiresLibrary: true,
    requiresCurve: true,
  },
  [ProofType.risc0]: {
    pallet: 'settlementRisc0Pallet',
    processor: Risc0Processor,
    supportedVersions: Object.keys(Risc0Version).map(
      (key) => Risc0Version[key as keyof typeof Risc0Version],
    ),
    requiresLibrary: false,
    requiresCurve: false,
  },
  [ProofType.ultraplonk]: {
    pallet: 'settlementUltraplonkPallet',
    processor: UltraPlonkProcessor,
    supportedVersions: [],
    requiresLibrary: false,
    requiresCurve: false,
  },
  [ProofType.proofofsql]: {
    pallet: 'settlementProofOfSqlPallet',
    processor: ProofOfSqlProcessor,
    supportedVersions: [],
    requiresLibrary: false,
    requiresCurve: false,
  },
  // ADD_NEW_PROOF_TYPE
};

export const zkvTypes = {
  MerkleProof: {
    root: 'H256',
    proof: 'Vec<H256>',
    number_of_leaves: 'u32',
    leaf_index: 'u32',
    leaf: 'H256',
  },
};

export const zkvRpc = {
  poe: {
    proofPath: {
      description: 'Get the Merkle root and path of a stored proof',
      params: [
        {
          name: 'root_id',
          type: 'u64',
        },
        {
          name: 'proof_hash',
          type: 'H256',
        },
        {
          name: 'at',
          type: 'BlockHash',
          isOptional: true,
        },
      ],
      type: 'MerkleProof',
    },
  },
  aggregate: {
    statementPath: {
      description: 'Get the Merkle root and path of a aggregate statement',
      params: [
        {
          name: 'at',
          type: 'BlockHash',
        },
        {
          name: 'domain_id',
          type: 'u32',
        },
        {
          name: 'aggregation_id',
          type: 'u64',
        },
        {
          name: 'statement',
          type: 'H256',
        },
      ],
      type: 'MerkleProof',
    },
  },
};
