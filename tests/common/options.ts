import { CurveType, Library, Plonky2HashFunction, ProofType, Risc0Version, UltrahonkVariant } from "../../src";

// ADD_NEW_PROOF_TYPE: Exclusion for Risc0 if needed (no data etc)
export const proofTypeVersionExclusions: Partial<Record<ProofType, string[]>> = {
    [ProofType.risc0]: []
};

export const testOptions = {
    proofTypes: Object.keys(ProofType).map(
        (key) => ProofType[key as keyof typeof ProofType]
    ),
    curveTypes: Object.keys(CurveType).map(
        (key) => CurveType[key as keyof typeof CurveType]
    ),
    libraries: Object.keys(Library).map(
        (key) => Library[key as keyof typeof Library]
    ),
    risc0Versions: Object.keys(Risc0Version).map(
        (key) => Risc0Version[key as keyof typeof Risc0Version]
    ),
    plonky2HashFunctions: Object.keys(Plonky2HashFunction).map(
        (key) => Plonky2HashFunction[key as keyof typeof Plonky2HashFunction]
    ),
    ultraplonkPublicInputCounts: [1],
    ultrahonkVariants: Object.keys(UltrahonkVariant).map(
        (key) => UltrahonkVariant[key as keyof typeof UltrahonkVariant]
    ),
    // ADD_NEW_PROOF_TYPE Testing: add config options here is required for new proof type
};