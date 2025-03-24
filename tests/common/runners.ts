import { CurveType, Library, ProofOptions, ProofType } from "../../src";
import {
    loadProofAndVK,
    performVerifyTransaction,
    performVKRegistrationAndVerification
} from "./utils";
import { walletPool } from "./walletPool";
import { proofConfigurations } from "../../src/config";
import { zkVerifySession } from "../../src";

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
    session: zkVerifySession,
    proofOptions: ProofOptions,
    withAggregation: boolean = false,
    version?: string
) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "verification test", version);

        const accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions, version);

        await performVerifyTransaction(
            session,
            accountAddress,
            proofOptions,
            proof.proof,
            proof.publicSignals,
            vk,
            withAggregation,
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

export const runVKRegistrationTest = async (
    session: zkVerifySession,
    proofOptions: ProofOptions,
    version?: string
) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "VK registration");

        const accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions, version);

        await performVKRegistrationAndVerification(
            session,
            accountAddress,
            proofOptions,
            proof.proof,
            proof.publicSignals,
            vk,
            version
        );
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
    withAggregation: boolean
) => {
    let session: zkVerifySession | undefined;

    try {
        session = await zkVerifySession.start().Testnet().readOnly();

        const testPromises = generateTestPromises(proofTypes, curveTypes, libraries, (proofOptions, version) =>
            runVerifyTest(session!, proofOptions, withAggregation, version)
        );

        const results = await Promise.allSettled(testPromises);
        const failures = results.filter(result => result.status === 'rejected');

        if (failures.length > 0) {
            throw new Error(`${failures.length} test(s) failed. See logs for details.`);
        }
    } catch (error) {
        console.error("Error running all proof tests:", error);
        throw error;
    } finally {
        if (session) {
            await session.close();
        }
    }
};

export const runAllVKRegistrationTests = async (
    proofTypes: ProofType[],
    curveTypes: CurveType[],
    libraries: Library[]
) => {
    const session = await zkVerifySession.start().Testnet().readOnly();

    try {
        const testPromises = generateTestPromises(proofTypes, curveTypes, libraries, (proofOptions, version) =>
            runVKRegistrationTest(session, proofOptions, version)
        );
        await Promise.all(testPromises);
    } finally {
        if (session) {
            await session.close();
        }
    }
};

