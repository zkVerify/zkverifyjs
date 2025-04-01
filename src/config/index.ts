import { NetworkConfig, ProofProcessor } from '../types';
import {
  Groth16Processor,
  ProofOfSqlProcessor,
  Risc0Processor,
  UltraPlonkProcessor,
} from '../proofTypes';
import { Risc0Version } from '../enums';

export enum SupportedNetwork {
  Volta = 'Volta',
  Custom = 'Custom',
  Testnet = 'Testnet',
  // ADD_NEW_SUPPORTED_NETWORK
}

export const SupportedNetworkConfig: Record<SupportedNetwork, NetworkConfig> = {
  [SupportedNetwork.Volta]: {
    host: SupportedNetwork.Volta,
    websocket: 'wss://volta-rpc.zkverify.io',
    rpc: 'https://volta-rpc.zkverify.io',
  },
  [SupportedNetwork.Testnet]: {
    host: SupportedNetwork.Testnet,
    websocket: 'wss://testnet-rpc.zkverify.io',
    rpc: 'https://testnet-rpc.zkverify.io',
  },
  // ADD_NEW_SUPPORTED_NETWORK
  [SupportedNetwork.Custom]: {
    host: SupportedNetwork.Custom,
    websocket: '',
    rpc: '',
  },
};

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
  Curve: {
    _enum: ['Bn254', 'Bls12_381'],
  },
  Groth16Vk: {
    curve: 'Curve',
    alphaG1: 'Bytes',
    betaG2: 'Bytes',
    gammaG2: 'Bytes',
    deltaG2: 'Bytes',
    gammaAbcG1: 'Vec<Bytes>',
  },
  Plonky2Config: {
    _enum: ['Keccak', 'Poseidon'],
  },
  Plonky2Vk: {
    config: 'Plonky2Config',
    bytes: 'Bytes',
  },
};

export const zkvRpc = {
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
  vk_hash: {
    groth16: {
      description: 'Get the hash of a Groth16 verification key',
      params: [
        {
          name: 'vk',
          type: 'Groth16Vk',
        },
      ],
      type: 'H256',
    },
    plonky2: {
      description: 'Get the hash of a Plonky2 verification key',
      params: [
        {
          name: 'vk',
          type: 'Plonky2Vk',
        },
      ],
      type: 'H256',
    },
    proofofsql: {
      description: 'Get the hash of a Proof-of-SQL verification key',
      params: [
        {
          name: 'vk',
          type: 'Bytes',
        },
      ],
      type: 'H256',
    },
    risc0: {
      description: 'Get the hash of a Risc0 verification key',
      params: [
        {
          name: 'vk',
          type: 'H256',
        },
      ],
      type: 'H256',
    },
    ultraplonk: {
      description: 'Get the hash of an UltraPLONK verification key',
      params: [
        {
          name: 'vk',
          type: 'Bytes',
        },
      ],
      type: 'H256',
    },
  },
};
