export interface TeeProof {
  proof: string;
}

export interface TeeVk {
  vk: {
    tcbResponse: string;
    certificates: string;
  };
}

export interface TeePubs {
  pubs: string;
}
