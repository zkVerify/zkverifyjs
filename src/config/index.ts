import {
  CurveType,
  Library,
  Plonky2HashFunction,
  Risc0Version,
} from '../enums';
import {
  FflonkProcessor,
  Groth16Processor,
  Plonky2Processor,
  Risc0Processor,
  SP1Processor,
  UltraPlonkProcessor,
} from '../proofTypes';
import { NetworkConfig, ProofProcessor } from '../types';

export const CHAIN_SS58_PREFIX = 251; // zkVerify specific address format

export enum SupportedNetwork {
  Volta = 'Volta',
  Custom = 'Custom',
  // ADD_NEW_SUPPORTED_NETWORK
}

export const SupportedNetworkConfig: Record<SupportedNetwork, NetworkConfig> = {
  [SupportedNetwork.Volta]: {
    host: SupportedNetwork.Volta,
    websocket: 'wss://volta-rpc.zkverify.io',
    rpc: 'https://volta-rpc.zkverify.io',
  },
  // ADD_NEW_SUPPORTED_NETWORK
  [SupportedNetwork.Custom]: {
    host: SupportedNetwork.Custom,
    websocket: '',
    rpc: '',
  },
};

export enum ProofType {
  fflonk = 'fflonk',
  groth16 = 'groth16',
  risc0 = 'risc0',
  ultraplonk = 'ultraplonk',
  plonky2 = 'plonky2',
  sp1 = 'sp1',
  // ADD_NEW_PROOF_TYPE
}

export interface ProofConfig {
  pallet: string;
  processor: ProofProcessor;
}

export const proofConfigurations: Record<ProofType, ProofConfig> = {
  [ProofType.fflonk]: {
    pallet: 'settlementFFlonkPallet',
    processor: FflonkProcessor,
  },
  [ProofType.groth16]: {
    pallet: 'settlementGroth16Pallet',
    processor: Groth16Processor,
  },
  [ProofType.risc0]: {
    pallet: 'settlementRisc0Pallet',
    processor: Risc0Processor,
  },
  [ProofType.ultraplonk]: {
    pallet: 'settlementUltraplonkPallet',
    processor: UltraPlonkProcessor,
  },
  [ProofType.plonky2]: {
    pallet: 'settlementPlonky2Pallet',
    processor: Plonky2Processor,
  },
  [ProofType.sp1]: {
    pallet: 'settlementSp1Pallet',
    processor: SP1Processor,
  },
  // ADD_NEW_PROOF_TYPE - configurations
};

export interface ProofOptions {
  proofType: ProofType;
  config?: Groth16Config | Plonky2Config | Risc0Config | UltraplonkConfig; // ADD_NEW_PROOF_TYPE
}

export interface Groth16Config {
  library: Library;
  curve: CurveType;
}

export interface Plonky2Config {
  hashFunction: Plonky2HashFunction;
}

export interface Risc0Config {
  version: Risc0Version;
}

export interface UltraplonkConfig {
  numberOfPublicInputs: number;
}

export type AllProofConfigs =
  | Groth16Config
  | Plonky2Config
  | Risc0Config
  | UltraplonkConfig
  | undefined;
// ADD_NEW_PROOF_TYPE - options if needed.

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
    fflonk: {
      description: 'Get the hash of a FFLONK verification key',
      params: [
        {
          name: 'vk',
          type: 'Bytes',
        },
      ],
      type: 'H256',
    },
    sp1: {
      description: 'Get the hash of an SP1 verification key',
      params: [
        {
          name: 'vk',
          type: 'H256',
        },
      ],
      type: 'H256',
    },
    // ADD_NEW_PROOF_TYPE
  },
};
