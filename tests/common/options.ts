import { CurveType, Library, Plonky2HashFunction, ProofType, Risc0Version } from "../../src";

//TODO: Update this once we have V1_1 test data
export const proofTypeVersionExclusions: Partial<Record<ProofType, string[]>> = {
    [ProofType.risc0]: ["V1_1"]
};

export type TestOptions = typeof testOptions;

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
    plonky2CompressionOptions: [true, false],
    // ADD_NEW_PROOF_TYPE Testing: add config options here is required for new proof type
};