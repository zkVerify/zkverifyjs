import { CurveType, Library, ProofOptions, ProofType } from "../../src";
import {
    loadProofAndVK,
    performVerifyTransaction,
    performVKRegistrationAndVerification
} from "./utils";
import { walletPool } from "./walletPool";
import { proofConfigurations } from "../../src/config";
import { zkVerifySession } from "../../src";
import {proofTypeVersionExclusions, testOptions, TestOptions} from "./options";

const logTestDetails = (proofOptions: ProofOptions, testType: string) => {
    const { proofType, config } = proofOptions;

    const configDetails =
        config && typeof config === 'object'
            ? Object.entries(config)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
            : '';

    const configSuffix = configDetails ? ` with ${configDetails}` : '';

    console.log(`Running ${testType} for ${proofType}${configSuffix}`);
};

export const runVerifyTest = async (
    session: zkVerifySession,
    proofOptions: ProofOptions,
    withAggregation: boolean = false
) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "verification test");

        const accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions);

        await performVerifyTransaction(
            session,
            accountAddress,
            proofOptions,
            proof.proof,
            proof.publicSignals,
            vk,
            withAggregation
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
    proofOptions: ProofOptions
) => {
    let seedPhrase: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "VK registration");

        const accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions);

        await performVKRegistrationAndVerification(
            session,
            accountAddress,
            proofOptions,
            proof.proof,
            proof.publicSignals,
            vk
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

export const generateTestPromises = (
    runTest: (proofOptions: ProofOptions) => Promise<void>
): Promise<void>[] => {
    const promises: Promise<void>[] = [];

    testOptions.proofTypes.forEach((proofType) => {
        const config = proofConfigurations[proofType];
        const excludedVersions = proofTypeVersionExclusions[proofType] || [];

        switch (proofType) {
            case ProofType.groth16:
                testOptions.libraries.forEach((library) => {
                    testOptions.curveTypes.forEach((curve) => {
                        promises.push(runTest({
                            proofType,
                            config: { library, curve },
                        }));
                    });
                });
                break;

            case ProofType.risc0:
                testOptions.risc0Versions
                    .filter((v) => !excludedVersions.includes(v))
                    .forEach((version) => {
                        promises.push(runTest({
                            proofType,
                            config: { version },
                        }));
                    });
                break;

            case ProofType.plonky2:
                testOptions.plonky2CompressionOptions.forEach((compressed) => {
                    testOptions.plonky2HashFunctions.forEach((hashFunction) => {
                        promises.push(runTest({
                            proofType,
                            config: { compressed, hashFunction },
                        }));
                    });
                });
                break;

            case ProofType.ultraplonk:
            case ProofType.proofofsql:
                promises.push(runTest({ proofType }));
                break;

            // ADD_NEW_PROOF_TYPE - generateTestPromises
        }
    });

    return promises;
};

export const runAllProofTests = async (
    withAggregation: boolean
) => {
    let session: zkVerifySession | undefined;

    try {
        session = await zkVerifySession.start().Volta().readOnly();

        const testPromises = generateTestPromises((proofOptions) =>
            runVerifyTest(session!, proofOptions, withAggregation)
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

export const runAllVKRegistrationTests = async () => {
    const session = await zkVerifySession.start().Volta().readOnly();

    try {
        const testPromises = generateTestPromises((proofOptions) =>
            runVKRegistrationTest(session, proofOptions)
        );
        await Promise.all(testPromises);
    } finally {
        if (session) {
            await session.close();
        }
    }
};

