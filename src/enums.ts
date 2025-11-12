export enum TransactionType {
  Verify = 1,
  VKRegistration = 2,
  DomainRegistration = 3,
  DomainHold = 4,
  DomainUnregister = 5,
  Aggregate = 6,
  BatchVerify = 7,
  DomainAddSubmitters = 8,
  DomainRemoveSubmitters = 9,
}

export enum TransactionStatus {
  Broadcast = 'broadcast',
  Dropped = 'dropped',
  Error = 'error',
  Finalized = 'finalized',
  InBlock = 'inBlock',
  Invalid = 'invalid',
  Pending = 'pending',
  Retracted = 'retracted',
  Usurped = 'usurped',
}

export enum ZkVerifyEvents {
  AggregationComplete = 'aggregationComplete',
  NewAggregationReceipt = 'newAggregationReceipt',
  Broadcast = 'broadcast',
  CannotAggregate = 'cannotAggregate',
  DomainStateChanged = 'domainStateChanged',
  ErrorEvent = 'error',
  Finalized = 'finalized',
  IncludedInBlock = 'includedInBlock',
  NewDomain = 'newDomain',
  NewProof = 'newProof',
  ProofVerified = 'proofVerified',
  Unsubscribe = 'unsubscribe',
  VkRegistered = 'vkRegistered',
}

export enum Risc0Version {
  V2_1 = 'V2_1',
  V2_2 = 'V2_2',
  V2_3 = 'V2_3',
  V3_0 = 'V3_0',
}

export enum Plonky2HashFunction {
  Keccak = 'Keccak',
  Poseidon = 'Poseidon',
}

export enum Library {
  arkworks = 'arkworks',
  gnark = 'gnark',
  snarkjs = 'snarkjs',
}

export enum CurveType {
  bn128 = 'bn128',
  bn254 = 'bn254',
  bls12381 = 'bls12381',
}

export enum AggregateSecurityRules {
  Untrusted = 'Untrusted',
  OnlyOwner = 'OnlyOwner',
  OnlyOwnerUncompleted = 'OnlyOwnerUncompleted',
}

export enum ProofSecurityRules {
  Untrusted = 'Untrusted',
  OnlyOwner = 'OnlyOwner',
  OnlyAllowlisted = 'OnlyAllowlisted',
}

export enum Destination {
  None = 'None',
  Hyperbridge = 'Hyperbridge',
}

export enum RuntimeVersion {
  V1_3_0 = 1003000,
}

export const PUBLIC_ZK_VERIFY_EVENTS: ZkVerifyEvents[] = [
  ZkVerifyEvents.NewAggregationReceipt,
  ZkVerifyEvents.ProofVerified,
  ZkVerifyEvents.NewProof,
  ZkVerifyEvents.VkRegistered,
  ZkVerifyEvents.NewDomain,
  ZkVerifyEvents.DomainStateChanged,
  ZkVerifyEvents.AggregationComplete,
];
