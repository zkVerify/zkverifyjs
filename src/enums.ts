export enum TransactionType {
  Verify = 1,
  VKRegistration = 2,
  DomainRegistration = 3, // Is this something we're setting, or should match something in the aggregate pallet?
  DomainHold = 4,
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
  AttestationBeforeExpected = 'attestationBeforeExpected',
  AttestationConfirmed = 'attestationConfirmed',
  AttestationMissed = 'attestationMissed',
  Broadcast = 'broadcast',
  DomainStateChanged = 'domainStateChanged',
  ErrorEvent = 'error',
  Finalized = 'finalized',
  IncludedInBlock = 'includedInBlock',
  NewDomain = 'newDomain',
  Unsubscribe = 'unsubscribe',
}

export enum Risc0Version {
  V1_0 = 'V1_0',
  V1_1 = 'V1_1',
  V1_2 = 'V1_2',
}
