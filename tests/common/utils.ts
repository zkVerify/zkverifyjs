import {
    zkVerifySession,
    ProofType,
    TransactionStatus,
    VerifyTransactionInfo,
    VKRegistrationTransactionInfo, CurveType, Library, ProofOptions
} from '../../src';
import {
    handleCommonEvents,
    handleEventsWithAttestation,
    EventResults,
} from './eventHandlers';
import path from "path";
import fs from "fs";
import { TransactionInfoByType } from "../../src/utils/transactions/types";
import { TransactionType } from "../../src";

export interface ProofData {
    proof: any;
    publicSignals: any;
    vk?: string;
}

export const proofTypes = Object.keys(ProofType).map((key) => ProofType[key as keyof typeof ProofType]);
export const curveTypes = Object.keys(CurveType).map((key) => CurveType[key as keyof typeof CurveType]);
export const libraries = Object.keys(Library).map((key) => Library[key as keyof typeof Library]);

export const loadProofData = (proofOptions: ProofOptions, version?: string): ProofData => {
    const { proofType, curve, library } = proofOptions;

    const fileName = [proofType, version?.toLowerCase(), library, curve].filter(Boolean).join('_');
    const dataPath = path.join(__dirname, 'data', `${fileName}.json`);

    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
};

export const loadVerificationKey = (proofOptions: ProofOptions, version?: string): string => {
    const { proofType, curve, library } = proofOptions;

    const fileName = [proofType, version?.toLowerCase(), library, curve].filter(Boolean).join('_');
    const dataPath = path.join(__dirname, 'data', `${fileName}.json`);

    const proofData: ProofData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    if (!proofData.vk) {
        throw new Error(`Verification key not found in file: ${dataPath}`);
    }
    return proofData.vk;
};

export const validateEventResults = (eventResults: EventResults, expectAttestation: boolean): void => {
    expect(eventResults.broadcastEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.errorEventEmitted).toBe(false);

    if (expectAttestation) {
        expect(eventResults.attestationConfirmedEmitted).toBe(true);
    } else {
        expect(eventResults.attestationConfirmedEmitted).toBe(false);
    }
    expect(eventResults.attestationBeforeExpectedEmitted).toBe(false);
    expect(eventResults.attestationMissedEmitted).toBe(false);
};

export const performVerifyTransaction = async (
    session: zkVerifySession,
    accountAddress: string,
    proofOptions: ProofOptions,
    proof: any,
    publicSignals: any,
    vk: string,
    withAttestation: boolean,
    version?: string
): Promise<{ eventResults: EventResults; transactionInfo: VerifyTransactionInfo }> => {
    try {
        console.log(
            `[IN PROGRESS] ${accountAddress} ${proofOptions.proofType}` +
            (version ? `:${version}` : '') +
            (proofOptions.library ? ` with library: ${proofOptions.library}` : '') +
            (proofOptions.curve ? ` with curve: ${proofOptions.curve}` : '')
        );

        const verifyTransaction = async () => {
            const verifier = session.verify(accountAddress)[proofOptions.proofType](
                proofOptions.library,
                proofOptions.curve
            );
            const verify = withAttestation ? verifier.waitForPublishedAttestation() : verifier;

            const { events, transactionResult } = await verify.execute({
                proofData: {
                    proof: proof,
                    publicSignals: publicSignals,
                    vk: vk,
                    version: version
                },
            });

            const eventResults = withAttestation
                ? handleEventsWithAttestation(events, proofOptions.proofType, 'verify')
                : handleCommonEvents(events, proofOptions.proofType, 'verify');

            console.log(
                `[RESULT RECEIVED] ${accountAddress} ${proofOptions.proofType}` +
                (version ? `:${version}` : '') +
                ` Transaction result received. Validating...`
            );

            const transactionInfo: VerifyTransactionInfo = await transactionResult;
            validateVerifyTransactionInfo(transactionInfo, proofOptions.proofType, withAttestation);
            validateEventResults(eventResults, withAttestation);

            return { eventResults, transactionInfo };
        };

        return await retryWithDelay(verifyTransaction);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(
            `[ERROR] Account: ${accountAddress}, ProofType: ${proofOptions.proofType}` +
            (version ? `:${version}` : ''),
            error
        );

        throw new Error(`Failed to execute transaction. See logs for details: ${errorMessage}`);
    }
};

export const performVKRegistrationAndVerification = async (
    session: zkVerifySession,
    accountAddress: string,
    proofOptions: ProofOptions,
    proof: any,
    publicSignals: any,
    vk: string,
    version?: string
): Promise<void> => {
    console.log(
        `${accountAddress} ${proofOptions.proofType} Executing VK registration with library: ${proofOptions.library}, curve: ${proofOptions.curve}...`
    );

    const { events: registerEvents, transactionResult: registerTransactionResult } =
        await session
            .registerVerificationKey(accountAddress)[proofOptions.proofType](
            proofOptions.library,
            proofOptions.curve
        )
        .execute(vk);

    const registerResults = handleCommonEvents(
        registerEvents,
        proofOptions.proofType,
        'vkRegistration'
    );

    const vkTransactionInfo: VKRegistrationTransactionInfo = await registerTransactionResult;
    validateVKRegistrationTransactionInfo(vkTransactionInfo, proofOptions.proofType);
    validateEventResults(registerResults, false);

    console.log(
        `${proofOptions.proofType} Executing verification using registered VK with library: ${proofOptions.library}, curve: ${proofOptions.curve}...`
    );

    const { events: verifyEvents, transactionResult: verifyTransactionResult } =
        await session
            .verify(accountAddress)[proofOptions.proofType](proofOptions.library, proofOptions.curve)
            .withRegisteredVk()
            .execute({
                proofData: {
                    proof: proof,
                    publicSignals: publicSignals,
                    vk: vkTransactionInfo.statementHash!,
                    version: version
                },
            });

    const verifyResults = handleCommonEvents(verifyEvents, proofOptions.proofType, 'verify');

    const verifyTransactionInfo: VerifyTransactionInfo = await verifyTransactionResult;
    validateVerifyTransactionInfo(verifyTransactionInfo, proofOptions.proofType, false);
    validateEventResults(verifyResults, false);
};

export const validateTransactionInfo = (
    transactionInfo: TransactionInfoByType[TransactionType.Verify] | TransactionInfoByType[TransactionType.VKRegistration],
    expectedProofType: string
): void => {
    expect(transactionInfo).toBeDefined();
    expect(transactionInfo.blockHash).not.toBeNull();
    expect(transactionInfo.proofType).toBe(expectedProofType);
    expect(transactionInfo.status).toBe(TransactionStatus.Finalized);
    expect(transactionInfo.txHash).toBeDefined();
    expect(transactionInfo.extrinsicIndex).toBeDefined();
    expect(transactionInfo.feeInfo).toBeDefined();
    expect(transactionInfo.weightInfo).toBeDefined();
    expect(transactionInfo.txClass).toBeDefined();
};

export const validateVerifyTransactionInfo = (
    transactionInfo: VerifyTransactionInfo,
    expectedProofType: string,
    expectAttestation: boolean
): void => {
    validateTransactionInfo(transactionInfo, expectedProofType);

    expect(transactionInfo.attestationId).not.toBeNull();
    expect(transactionInfo.leafDigest).not.toBeNull();

    if(expectAttestation) {
        expect(transactionInfo.attestationConfirmed).toBeTruthy();
        expect(transactionInfo.attestationEvent).toBeDefined();
        expect(transactionInfo.attestationEvent!.id).toBeDefined();
        expect(transactionInfo.attestationEvent!.attestation).toBeDefined();
    } else {
        expect(transactionInfo.attestationConfirmed).toBeFalsy();
        expect(transactionInfo.attestationEvent).not.toBeDefined();
    }
};

export const validateVKRegistrationTransactionInfo = (
    transactionInfo: VKRegistrationTransactionInfo,
    expectedProofType: string
): void => {
    validateTransactionInfo(transactionInfo, expectedProofType);
    expect(transactionInfo.statementHash).toBeDefined();
};

export const loadProofAndVK = (proofOptions: ProofOptions, version?: string) => {
    return {
        proof: loadProofData(proofOptions, version),
        vk: loadVerificationKey(proofOptions, version),
    };
};

const retryWithDelay = async <T>(
    fn: () => Promise<T>,
    retries: number = 5,
    delayMs: number = 5000
): Promise<T> => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (!errorMessage.includes("Priority is too low")) {
                throw error;
            }

            if (attempt >= retries) {
                throw error;
            }

            console.warn(`Retrying after error: ${errorMessage}. Attempt ${attempt} of ${retries}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw new Error("Retries exhausted");
};