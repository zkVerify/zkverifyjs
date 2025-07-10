import { AggregateStatementPathResult, AggregateTransactionInfo } from "../../src/types";
import {
    BatchVerifyTransactionInfo,
    DomainOptions,
    DomainTransactionInfo,
    ProofOptions,
    ProofType,
    RegisterDomainTransactionInfo,
    TransactionInfo,
    TransactionStatus,
    TransactionType,
    VKRegistrationTransactionInfo,
    VerifyTransactionInfo,
    ZkVerifyEvents,
    zkVerifySession
} from '../../src';
import { EventResults, handleCommonEvents } from './eventHandlers';
import { Groth16Config, Plonky2Config, Risc0Config } from "../../src";

import fs from "fs";
import { isRisc0Config } from "../../src/utils/helpers";
import path from "path";
import {UltraplonkConfig} from "../../src/config";

export interface ProofData {
    proof: any;
    publicSignals: any;
    vk?: string;
}

export function getProofFilenameComponents(proofOptions: ProofOptions): string[] {
    const { proofType, config } = proofOptions;
    const components: string[] = [proofType];

    switch (proofType) {
        case ProofType.groth16: {
            const { library, curve } = config as Groth16Config;
            components.push(library.toLowerCase(), curve.toLowerCase());
            break;
        }
        case ProofType.plonky2: {
            const { hashFunction } = config as Plonky2Config;
            components.push(hashFunction.toLowerCase());
            break;
        }
        case ProofType.risc0: {
            const { version } = config as Risc0Config;
            components.push(version.toLowerCase());
            break;
        }
        case ProofType.ultraplonk: {
            const { numberOfPublicInputs } = config as UltraplonkConfig;
            components.push(numberOfPublicInputs.toString());
            break;
        }
        // ADD_NEW_PROOF_TYPE
    }

    return components.filter(Boolean).map(String);
}

export const loadProofData = (proofOptions: ProofOptions): ProofData => {
    const fileName = getProofFilenameComponents(proofOptions).join('_') + '.json';
    const dataPath = path.join(__dirname, 'data', fileName);

    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
};

export const loadVerificationKey = (proofOptions: ProofOptions): string => {
    const fileName = getProofFilenameComponents(proofOptions).join('_').toLowerCase() + '.json';
    const dataPath = path.join(__dirname, 'data', fileName);
    const proofData: ProofData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    if (!proofData.vk) {
        throw new Error(`Verification key not found in file: ${dataPath}`);
    }

    return proofData.vk;
};

export const validateEventResults = (eventResults: EventResults): void => {
    expect(eventResults.broadcastEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.errorEventEmitted).toBe(false);
};

export const performVerifyTransaction = async (
    session: zkVerifySession,
    accountAddress: string,
    proofOptions: ProofOptions,
    proof: any,
    publicSignals: any,
    vk: string,
    withAggregation: boolean
): Promise<{ eventResults: EventResults; transactionInfo: VerifyTransactionInfo }> => {
    // 0 = Volta / Ethereum Sepolia
    const domainId: number | undefined = withAggregation ? 0 : undefined;

    try {
        console.log(
            `[IN PROGRESS] ${accountAddress} ${proofOptions.proofType}${formatProofConfigDetails(proofOptions)}`
        );

        const verifyTransaction = async () => {
            const verify = dispatchBuilder(session.verify(accountAddress), proofOptions);

            const input = {
                proofData: {
                    proof,
                    publicSignals,
                    vk
                },
                domainId
            };

            const { events, transactionResult } = await verify.execute(input);

            const eventResults = handleCommonEvents(events, proofOptions.proofType, TransactionType.Verify, withAggregation);

            const transactionInfo: VerifyTransactionInfo = await transactionResult;
            console.log(
                `[RESULT RECEIVED] ${accountAddress} ${proofOptions.proofType}${formatProofConfigDetails(proofOptions)} Transaction result received. Validating...`
            );

            validateVerifyTransactionInfo(transactionInfo, proofOptions.proofType, withAggregation);
            console.log(
                `[VALIDATING] ${accountAddress} ${proofOptions.proofType}${formatProofConfigDetails(proofOptions)} validateVerifyTransactionInfo`
            );

            validateEventResults(eventResults);

            return { eventResults, transactionInfo };
        };

        return await retryWithDelay(verifyTransaction);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(
            `[ERROR] Account: ${accountAddress}, ProofType: ${proofOptions.proofType}${formatProofConfigDetails(proofOptions)}`,
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
        `${accountAddress} ${proofOptions.proofType} Executing VK registration` +
        (proofOptions.config
            ? ' with ' +
            Object.entries(proofOptions.config)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
            : '') +
        '...'
    );

    const register = dispatchBuilder(session.registerVerificationKey(accountAddress), proofOptions);

    const { events: registerEvents, transactionResult: registerTransactionResult } =
        await register
        .execute(vk);

    const registerResults = handleCommonEvents(
        registerEvents,
        proofOptions.proofType,
        TransactionType.VKRegistration
    );

    const vkTransactionInfo: VKRegistrationTransactionInfo = await registerTransactionResult;
    validateVKRegistrationTransactionInfo(vkTransactionInfo, proofOptions.proofType);
    validateEventResults(registerResults);

    console.log(
        `${proofOptions.proofType} Executing verification using registered VK${formatProofConfigDetails(proofOptions)}...`
    );

    const verify = dispatchBuilder(session.verify(accountAddress), proofOptions);

    const { events: verifyEvents, transactionResult: verifyTransactionResult } =
        await verify
            .withRegisteredVk()
            .execute({
                proofData: {
                    proof: proof,
                    publicSignals: publicSignals,
                    vk: vkTransactionInfo.statementHash!
                },
            });

    const verifyResults = handleCommonEvents(verifyEvents, proofOptions.proofType, TransactionType.Verify);

    const verifyTransactionInfo: VerifyTransactionInfo = await verifyTransactionResult;
    validateVerifyTransactionInfo(verifyTransactionInfo, proofOptions.proofType, false);
    validateEventResults(verifyResults);
};

export const validateTransactionInfo = (
    transactionInfo: TransactionInfo,
): void => {
    expect(transactionInfo).toBeDefined();
    expect(transactionInfo.blockHash).toBeDefined();
    expect(typeof transactionInfo.blockHash).toBe('string');
    expect(transactionInfo.status).toBe(TransactionStatus.Finalized);

    expect(transactionInfo.txHash).toBeDefined();
    expect(typeof transactionInfo.txHash).toBe('string');

    expect(transactionInfo.extrinsicIndex).toBeGreaterThanOrEqual(0);

    expect(transactionInfo.feeInfo).toBeDefined();
    expect(transactionInfo.feeInfo!.payer).toBeDefined();
    expect(transactionInfo.feeInfo!.actualFee).toBeDefined();

    expect(transactionInfo.weightInfo).toBeDefined();
    expect(transactionInfo.weightInfo!.refTime).toBeDefined();
    expect(transactionInfo.weightInfo!.proofSize).toBeDefined();

    expect(transactionInfo.txClass).toBeDefined();
};

export const validateVerifyTransactionInfo = (
    transactionInfo: VerifyTransactionInfo,
    expectedProofType: string,
    expectAggregation: boolean
): void => {
    validateTransactionInfo(transactionInfo);

    expect(transactionInfo.proofType).toBe(expectedProofType);
    expect(transactionInfo.statement).toBeDefined();
    expect(typeof transactionInfo.statement).toBe('string');

    if (expectAggregation) {
        expect(transactionInfo.domainId).toBeDefined();
        expect(transactionInfo.aggregationId).toBeDefined();
        expect(typeof transactionInfo.domainId).toBe('number');
        expect(typeof transactionInfo.aggregationId).toBe('number');
    } else {
        expect(transactionInfo.domainId).toBeUndefined();
        expect(transactionInfo.aggregationId).toBeUndefined();
    }
};

export const validateVKRegistrationTransactionInfo = (
    transactionInfo: VKRegistrationTransactionInfo,
    expectedProofType: string
): void => {
    expect(transactionInfo.proofType).toBe(expectedProofType);
    validateTransactionInfo(transactionInfo);
    expect(transactionInfo.statementHash).toBeDefined();
};

export const validateBatchVerifyTransactionInfo = (
    transactionInfo: BatchVerifyTransactionInfo,
    expectedProofType: string
): void => {
    expect(transactionInfo.proofType).toBe(expectedProofType);
    expect(transactionInfo.batchCount).toBeGreaterThan(0);
    validateTransactionInfo(transactionInfo);
};

export const loadProofAndVK = (proofOptions: ProofOptions) => {
    return {
        proof: loadProofData(proofOptions),
        vk: loadVerificationKey(proofOptions),
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

export const performRegisterDomain = async (
    session: zkVerifySession,
    aggregationSize: number,
    queueSize: number,
    deliveryOptions: DomainOptions,
    signerAccount?: string
): Promise<number> => {
    const { events, transactionResult } = session.registerDomain(aggregationSize, queueSize, deliveryOptions, signerAccount);

    const eventResults = handleCommonEvents(
        events,
        'Domain',
        TransactionType.DomainRegistration
    );

    let newDomainId: number | undefined;
    let domainAssertionError: Error | null = null;

    events.on(ZkVerifyEvents.NewDomain, (data) => {
        try {
            expect(data.domainId).toBeGreaterThan(0);
            newDomainId = data.domainId;
        } catch (err) {
            domainAssertionError = err as Error;
        }
    });

    const transactionInfo = await transactionResult;

    validateRegisterDomainTransactionInfo(transactionInfo)

    expect(transactionInfo.domainId).toBe(newDomainId);
    expect(eventResults.errorEventEmitted).toBe(false);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);

    return transactionInfo.domainId!;
};

export const performHoldDomain = async (
    session: zkVerifySession,
    domainId: number,
    expectRemovable: boolean,
    accountAddress?: string
): Promise<void> => {
    const { events, transactionResult } = session.holdDomain(domainId, accountAddress);

    const eventResults = handleCommonEvents(
        events,
        'Domain',
        TransactionType.DomainHold
    );

    let domainStateAssertionError: Error | null = null;

    events.on(ZkVerifyEvents.DomainStateChanged, (data) => {
        try {
            expect(data.domainId).toBe(domainId);
            if(expectRemovable) {
                expect(data.domainState).toBe('Removable');
            } else {
                expect(data.domainState).toBe('Hold');
            }

        } catch (error) {
            domainStateAssertionError = error as Error;
        }
    });

    const transactionInfo = await transactionResult;

    validateDomainTransactionInfo(transactionInfo, expectRemovable ? 'Removable' : 'Hold');

    if (domainStateAssertionError) throw domainStateAssertionError;

    expect(eventResults.errorEventEmitted).toBe(false);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
};

export const performUnregisterDomain = async (
    session: zkVerifySession,
    domainId: number,
    accountAddress?: string
): Promise<void> => {
    const { events, transactionResult } = session.unregisterDomain(domainId, accountAddress);

    const eventResults = handleCommonEvents(
        events,
        'Domain',
        TransactionType.DomainUnregister
    );

    let assertionError: Error | null = null;

    events.on(ZkVerifyEvents.DomainStateChanged, (data) => {
        try {
            expect(data.domainId).toBe(domainId);
            expect(data.domainState).toBe('Removed');
        } catch (e) {
            assertionError = e as Error;
        }
    });

    const transactionInfo = await transactionResult;

    validateDomainTransactionInfo(transactionInfo, 'Removed')

    if (assertionError) throw assertionError;

    expect(eventResults.errorEventEmitted).toBe(false);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
};

export const performAggregate = async (
    session: zkVerifySession,
    domainId: number,
    aggregationId: number,
    accountAddress?: string
): Promise<void> => {
    let newAggregationReceiptEmitted: boolean = false;

    const { events, transactionResult } = session.aggregate(domainId, aggregationId, accountAddress);

    const eventResults = handleCommonEvents(
        events,
        'Domain',
        TransactionType.Aggregate
    );

    let assertionError: Error | null = null;

    events.on(ZkVerifyEvents.NewAggregationReceipt, (eventData: any) => {
        newAggregationReceiptEmitted = true;
        try {
            expect(eventData).toBeDefined();
            expect(eventData.domainId).toBeDefined();
            expect(eventData.aggregationId).toBeDefined();
            expect(eventData.receipt).toBeDefined();
        } catch (error) {
            assertionError = error as Error;
        }
    });

    const transactionInfo = await transactionResult;

    validateAggregateTransactionInfo(transactionInfo)

    if (assertionError) throw assertionError;

    expect(eventResults.errorEventEmitted).toBe(false);
    expect(newAggregationReceiptEmitted).toBe(true);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
};

export const validateRegisterDomainTransactionInfo = (
    transactionInfo: RegisterDomainTransactionInfo
): void => {
    validateTransactionInfo(transactionInfo);
    expect(transactionInfo.domainId).toBeDefined();
    expect(typeof transactionInfo.domainId).toBe('number');
    expect(transactionInfo.domainId).toBeGreaterThanOrEqual(0);
};

export const validateDomainTransactionInfo = (
    transactionInfo: DomainTransactionInfo,
    expectedDomainState: string
): void => {
    validateTransactionInfo(transactionInfo);

    expect(transactionInfo.domainId).toBeDefined();
    expect(typeof transactionInfo.domainId).toBe('number');
    expect(transactionInfo.domainId).toBeGreaterThanOrEqual(0);
    expect(transactionInfo.domainState).toBeDefined();
    expect(typeof transactionInfo.domainState).toBe('string');

    expect(transactionInfo.domainState).toBe(expectedDomainState);
};

export const validateAggregateTransactionInfo = (
    transactionInfo: AggregateTransactionInfo
): void => {
    validateTransactionInfo(transactionInfo);

    expect(transactionInfo.domainId).toBeDefined();
    expect(typeof transactionInfo.domainId).toBe('number');
    expect(transactionInfo.domainId).toBeGreaterThanOrEqual(0);
    expect(transactionInfo.aggregationId).toBeDefined();
    expect(typeof transactionInfo.aggregationId).toBe('number');
    expect(transactionInfo.aggregationId).toBeGreaterThanOrEqual(0);
    expect(transactionInfo.receipt).toBeDefined();
    expect(typeof transactionInfo.receipt).toBe('string');
};

export function validateAggregateStatementPathResult(result: unknown): asserts result is AggregateStatementPathResult {
    if (typeof result !== 'object' || result === null) {
        throw new Error('Result must be a non-null object.');
    }

    if (!('root' in result && 'proof' in result && 'numberOfLeaves' in result && 'leafIndex' in result && 'leaf' in result)) {
        throw new Error('Result object is missing one or more required properties: root, proof, numberOfLeaves, leafIndex, leaf.');
    }

    const { root, proof, numberOfLeaves, leafIndex, leaf } = result as Record<string, unknown>;

    if (typeof root !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(root)) {
        throw new Error(`Invalid 'root': Received ${JSON.stringify(root)}`);
    }

    if (!Array.isArray(proof)) {
        throw new Error(`'proof' must be an array. Received: ${typeof proof}`);
    }

    if (typeof numberOfLeaves !== 'number' || !Number.isInteger(numberOfLeaves) || numberOfLeaves < 1) {
        throw new Error(`Invalid 'numberOfLeaves': Received ${JSON.stringify(numberOfLeaves)}. Must be a positive integer >= 1.`);
    }

    if (typeof leafIndex !== 'number' || !Number.isInteger(leafIndex) || leafIndex < 0) {
        throw new Error(`Invalid 'leafIndex': Received ${JSON.stringify(leafIndex)}. Must be a non-negative integer.`);
    }

    if (typeof leaf !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(leaf)) {
        throw new Error(`Invalid 'leaf': Received ${JSON.stringify(leaf)}`);
    }
}

export function dispatchBuilder<T>(
    methodMap: Record<ProofType, (config?: any) => T>,
    proofOptions: ProofOptions
): T {
    switch (proofOptions.proofType) {
        case ProofType.groth16:
            return methodMap.groth16(proofOptions.config as Groth16Config);
        case ProofType.plonky2:
            return methodMap.plonky2(proofOptions.config as Plonky2Config);
        case ProofType.risc0:
            return methodMap.risc0(proofOptions.config as Risc0Config);
        case ProofType.ultraplonk:
            return methodMap.ultraplonk(proofOptions.config as UltraplonkConfig);
        case ProofType.fflonk:
            return methodMap.fflonk();
        // ADD_NEW_PROOF_TYPE - used for tests.
        default:
            throw new Error(`Unsupported proof type: ${proofOptions.proofType}`);
    }
}

export const formatProofConfigDetails = (proofOptions: ProofOptions): string => {
    if (!proofOptions.config) return '';
    return ' ' + Object.entries(proofOptions.config)
        .map(([key, value]) => `with ${key}: ${value}`)
        .join(' ');
};
