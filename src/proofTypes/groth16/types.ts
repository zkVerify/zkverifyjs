import { ProofOptions } from '../../config';

export interface Groth16VerificationKeyInput {
  curve: string;
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
}

export interface Groth16VerificationKey {
  curve: string;
  alpha_g1: string;
  beta_g2: string;
  gamma_g2: string;
  delta_g2: string;
  gamma_abc_g1: string[];
}

export type ProofInput =
  | SnarkJSProofInput
  | ArkworksProofInput
  | GnarkProofInput;

export interface SnarkJSProofInput {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface ArkworksProofInput {
  curve: string;
  proof: {
    a: string;
    b: string;
    c: string;
  };
}

export interface GnarkProofInput {
  Ar: { X: string; Y: string };
  Bs: {
    X: { A0: string; A1: string };
    Y: { A0: string; A1: string };
  };
  Krs: { X: string; Y: string };
}

export interface ProofInner {
  a: string;
  b: string;
  c: string;
}

export interface Proof {
  curve?: string;
  proof: ProofInner;
}

export interface Formatter {
  formatProof(proof: unknown, options: ProofOptions): Proof;
  formatVk(vk: unknown, options: ProofOptions): Groth16VerificationKey;
  formatPubs(pubs: string[]): string[];
}
