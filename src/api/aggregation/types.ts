export type NewAggregationEventSubscriptionOptions =
  | undefined
  | { domainId: number }
  | { domainId: number; aggregationId: number; timeout?: number };

export type WaitForAggregationReceiptOptions = {
  domainId: number;
  aggregationId: number;
  timeout?: number;
};
