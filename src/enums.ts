export enum TransactionType {
  Verify = 1,
  VKRegistration = 2,
  DomainRegistration = 3,
  DomainHold = 4,
  DomainUnregister = 5,
  Aggregate = 6,
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
  AggregationBeforeExpected = 'aggregationBeforeExpected',
  AggregationComplete = 'aggregationComplete',
  AggregationMatched = 'aggregationMatched',
  AggregationMissed = 'aggregationMissed',
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
  V1_0 = 'V1_0',
  V1_1 = 'V1_1',
  V1_2 = 'V1_2',
}

export enum AggregateSecurityRules {
  Untrusted = 'Untrusted',
  OnlyOwner = 'OnlyOwner',
  OnlyOwnerUncompleted = 'OnlyOwnerUncompleted',
}

export enum Destination {
  None = 'None',
  Hyperbridge = 'Hyperbridge',
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
