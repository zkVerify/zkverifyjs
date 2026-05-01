export interface UltraHonkProof {
  proof: string;
}

export interface UltraHonkVk {
  vk: string;
}

export type VersionedUltraHonkProof = Record<string, Record<string, string>>;

export type VersionedUltraHonkVk = Record<string, string>;

export interface UltraHonkPubs {
  pubs: string[];
}
