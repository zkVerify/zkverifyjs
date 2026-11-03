import { ProofOptions, ProofType, Risc0Version, RuntimeVersion, UltrahonkVariant, UltrahonkVersion } from "../../src";
import { RuntimeSpec } from "../../src/types";
import {
    loadProofAndVK,
    performVKRegistrationAndVerification,
    performVerifyTransaction
} from "./utils";
import { disabledProofTypes, proofTypeVersionExclusions, testOptions } from "./options";

import { walletPool } from "./walletPool";
import { zkVerifySession } from "../../src";

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
    let accountAddress: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "verification test");

        accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions, session.connection.runtimeSpec);

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
        accountAddress && await session.removeAccount(accountAddress);
        envVar && await walletPool.releaseWallet(envVar);
    }
};

export const runVKRegistrationTest = async (
    session: zkVerifySession,
    proofOptions: ProofOptions
) => {
    let seedPhrase: string | undefined;
    let accountAddress: string | undefined;
    let envVar: string | undefined;

    try {
        [envVar, seedPhrase] = await walletPool.acquireWallet();
        logTestDetails(proofOptions, "VK registration");

        accountAddress = await session.addAccount(seedPhrase);
        const { proof, vk } = loadProofAndVK(proofOptions, session.connection.runtimeSpec);

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
        accountAddress && await session.removeAccount(accountAddress);
        envVar && await walletPool.releaseWallet(envVar);
    }
};

export const generateTestPromises = (
    runTest: (proofOptions: ProofOptions) => Promise<void>,
    runtimeSpec?: RuntimeSpec
): Promise<void>[] => {
    const promises: Promise<void>[] = [];

    testOptions.proofTypes.forEach((proofType) => {
        if (disabledProofTypes.has(proofType)) {
            return;
        }

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
                    // V2_1 is rejected by the verifier from runtime v2.1.0.
                    .filter((v) => !(supportsV2_1_0(runtimeSpec) && v === Risc0Version.V2_1))
                    .forEach((version) => {
                        promises.push(runTest({
                            proofType,
                            config: { version },
                        }));
                    });
                break;

            case ProofType.plonky2:
                testOptions.plonky2HashFunctions.forEach((hashFunction) => {
                    promises.push(runTest({
                        proofType,
                        config: { hashFunction },
                    }));
                });
                break;

            case ProofType.ultraplonk:
                testOptions.ultraplonkPublicInputCounts.forEach((numberOfPublicInputs) => {
                    promises.push(runTest({
                        proofType,
                        config: { numberOfPublicInputs },
                    }));
                });
                break;

            case ProofType.ultrahonk:
                // Fallback coverage: SDK defaults missing version to V0_84 on runtime v1.6.0,
                // to Legacy on runtime v1.6.1+, and V5_0 on runtime v2.1.0+.
                // Remove these generated cases when support for pre-versioned Ultrahonk calls is dropped.
                testOptions.ultrahonkVariants.forEach((variant) => {
                    promises.push(runTest({
                        proofType,
                        config: { variant },
                    }));
                });
                if (!supportsV1_6_0(runtimeSpec)) {
                    break;
                }
                testOptions.ultrahonkVersions
                    .filter((v) => !excludedVersions.includes(v))
                    .filter((v) =>
                        supportsV1_6_1(runtimeSpec) ? true : v !== UltrahonkVersion.Legacy
                    )
                    .filter((v) =>
                        supportsV2_1_0(runtimeSpec) ? true : v !== UltrahonkVersion.V5_0
                    )
                    .forEach((version) => {
                        testOptions.ultrahonkVariants
                            .filter((variant) => !isDeprecatedUltrahonkZk(runtimeSpec, version, variant))
                            .forEach((variant) => {
                                promises.push(runTest({
                                    proofType,
                                    config: { version, variant },
                                }));
                            });
                    });
                break;

            case ProofType.ezkl:
                promises.push(runTest({ proofType }));
                break;

            case ProofType.fflonk:
                promises.push(runTest({ proofType }));
                break;

            case ProofType.sp1:
                promises.push(runTest({ proofType }));
                break;

            case ProofType.tee:
                // Legacy fallback coverage: SDK defaults missing variant to Intel on runtime v1.6.0+.
                // Remove this generated case when support for variant-less TEE calls is dropped.
                promises.push(runTest({ proofType }));
                if (!supportsV1_6_0(runtimeSpec)) {
                    break;
                }
                testOptions.teeVariants.forEach((variant) => {
                    promises.push(runTest({
                        proofType,
                        config: { variant },
                    }));
                });
                break;

            // ADD_NEW_PROOF_TYPE - generateTestPromises
        }
    });

    return promises;
};

const supportsV1_6_0 = (runtimeSpec?: RuntimeSpec): boolean =>
    runtimeSpec === undefined || runtimeSpec.specVersion >= RuntimeVersion.V1_6_0;

const supportsV1_6_1 = (runtimeSpec?: RuntimeSpec): boolean =>
    runtimeSpec === undefined || runtimeSpec.specVersion >= RuntimeVersion.V1_6_1;

const supportsV2_1_0 = (runtimeSpec?: RuntimeSpec): boolean =>
    runtimeSpec === undefined || runtimeSpec.specVersion >= RuntimeVersion.V2_1_0;

// From runtime v2.1.0 only V5_0 accepts ZK proofs; older versions are Plain-only.
const isDeprecatedUltrahonkZk = (
    runtimeSpec: RuntimeSpec | undefined,
    version: UltrahonkVersion,
    variant: UltrahonkVariant
): boolean =>
    supportsV2_1_0(runtimeSpec) &&
    variant === UltrahonkVariant.ZK &&
    version !== UltrahonkVersion.V5_0;

export const runAllProofTests = async (
    withAggregation: boolean
) => {
    let session: zkVerifySession | undefined;

    try {
        session = await zkVerifySession.start().Volta().readOnly();

        const testPromises = generateTestPromises(
            (proofOptions) => runVerifyTest(session!, proofOptions, withAggregation),
            session.connection.runtimeSpec
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
        const testPromises = generateTestPromises(
            (proofOptions) => runVKRegistrationTest(session, proofOptions),
            session.connection.runtimeSpec
        );
        await Promise.all(testPromises);
    } finally {
        if (session) {
            await session.close();
        }
    }
};

