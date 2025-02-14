import { CurveType, Library, ProofOptions, ProofType } from "../../src";
import {
    loadProofAndVK,
    performVerifyTransaction,
    performVKRegistrationAndVerification
} from "./utils";
import { walletPool } from "./walletPool";
import { proofConfigurations } from "../../src/config";

//TODO: Update this once we have V1_1 test data
const proofTypeVersionExclusions: Partial<Record<ProofType, string[]>> = {
    [ProofType.risc0]: ["V1_1"]
};

const logTestDetails = (proofOptions: ProofOptions, testType: string, version?: string) => {
    const { proofType, library, curve } = proofOptions;
    const details = [library && `library: ${library}`, curve && `curve: ${curve}`].filter(Boolean).join(", ");
    console.log(`Running ${testType} for ${proofType}${version ? `:${version}` : ""}${details ? ` with ${details}` : ""}`);
};

export const runVerifyTest = async (
    proofOptions: ProofOptions,
    withAttestation: boolean = false,
    checkExistence: boolean = false,
    version?: string
) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "verification test", version);
        const { proof, vk } = loadProofAndVK(proofOptions, version);
        await performVerifyTransaction(
            seedPhrase,
            proofOptions,
            proof.proof,
            proof.publicSignals,
            vk,
            withAttestation,
            checkExistence,
            version
        );
    } catch (error) {
        console.error(`Error during runVerifyTest (${envVar}) for ${proofOptions.proofType}:`, error);
        throw error;
    } finally {
        if (envVar) {
            await walletPool.releaseWallet(envVar);
        }
    }
};

export const runVKRegistrationTest = async (proofOptions: ProofOptions, version?: string) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "VK registration");
        const { proof, vk } = loadProofAndVK(proofOptions, version);
        await performVKRegistrationAndVerification(seedPhrase, proofOptions, proof.proof, proof.publicSignals, vk, version);
    } catch (error) {
        console.error(`Error during runVKRegistrationTest (${envVar}) for ${proofOptions.proofType}:`, error);
        throw error;
    } finally {
        if (envVar) {
            await walletPool.releaseWallet(envVar);
        }
    }
};

const generateTestPromises = (
    proofTypes: ProofType[],
    curveTypes: CurveType[],
    libraries: Library[],
    runTest: (proofOptions: ProofOptions, version?: string) => Promise<void>
): Promise<void>[] => {
    const promises: Promise<void>[] = [];

    proofTypes.forEach((proofType) => {
        const config = proofConfigurations[proofType];
        const supportedVersions = config.supportedVersions;
        const excludedVersions = proofTypeVersionExclusions[proofType] || [];

        const versionsToUse = supportedVersions.filter(
            (version) => !(excludedVersions && excludedVersions.includes(version))
        );

        if (versionsToUse.length > 0) {
            versionsToUse.forEach((version) => {
                if (config.requiresCurve && config.requiresLibrary) {
                    libraries.forEach((library) => {
                        curveTypes.forEach((curve) => {
                            promises.push(runTest({ proofType, curve, library }, version));
                        });
                    });
                } else {
                    promises.push(runTest({ proofType }, version));
                }
            });
        } else {
            if (config.requiresCurve && config.requiresLibrary) {
                libraries.forEach((library) => {
                    curveTypes.forEach((curve) => {
                        promises.push(runTest({ proofType, curve, library }));
                    });
                });
            } else {
                promises.push(runTest({ proofType }));
            }
        }
    });

    return promises;
};

export const runAllProofTests = async (
    proofTypes: ProofType[],
    curveTypes: CurveType[],
    libraries: Library[],
    withAttestation: boolean
) => {
    const testPromises = generateTestPromises(proofTypes, curveTypes, libraries, (proofOptions, version) =>
        runVerifyTest(proofOptions, withAttestation, false, version)
    );

    const results = await Promise.allSettled(testPromises);
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length > 0) {
        throw new Error(`${failures.length} test(s) failed. See logs for details.`);
    }
};

export const runAllVKRegistrationTests = async (
    proofTypes: ProofType[],
    curveTypes: CurveType[],
    libraries: Library[]
) => {
    const testPromises = generateTestPromises(proofTypes, curveTypes, libraries, runVKRegistrationTest);
    await Promise.all(testPromises);
};
