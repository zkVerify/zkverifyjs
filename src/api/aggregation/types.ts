export type NewAggregationEventSubscriptionOptions =
  | undefined
  | { domainId: number }
  | { domainId: number; aggregationId: number };
