export interface TeeProof {
  proof: string;
}

export interface TeeVk {
  vk: {
    tcbResponse: string;
    certificates: string;
  };
}

export interface TeeIntelVk {
  tcb_response: string;
  certificates: string;
}

export type VariantTeeVk = Record<string, TeeIntelVk>;

export interface TeePubs {
  pubs: string;
}
