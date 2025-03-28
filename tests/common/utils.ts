import {
    CurveType,
    DomainOptions,
    DomainTransactionInfo,
    Library,
    ProofOptions,
    ProofType,
    RegisterDomainTransactionInfo,
    TransactionInfo,
    TransactionStatus,
    TransactionType,
    VerifyTransactionInfo,
    VKRegistrationTransactionInfo,
    zkVerifySession,
    ZkVerifyEvents
} from '../../src';
import { EventResults, handleCommonEvents } from './eventHandlers';
import path from "path";
import fs from "fs";
import {AggregateTransactionInfo} from "../../src/types";



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
    withAggregation: boolean,
    version?: string
): Promise<{ eventResults: EventResults; transactionInfo: VerifyTransactionInfo }> => {
    // 0 = Volta / Ethereum Sepolia
    const domainId: number | undefined = withAggregation ? 0 : undefined;

    try {
        console.log(
            `[IN PROGRESS] ${accountAddress} ${proofOptions.proofType}` +
            (version ? `:${version}` : '') +
            (proofOptions.library ? ` with library: ${proofOptions.library}` : '') +
            (proofOptions.curve ? ` with curve: ${proofOptions.curve}` : '')
        );

        const verifyTransaction = async () => {
            const verify = session.verify(accountAddress)[proofOptions.proofType](
                proofOptions.library,
                proofOptions.curve
            );

            const { events, transactionResult } = await verify.execute({
                proofData: {
                    proof: proof,
                    publicSignals: publicSignals,
                    vk: vk,
                    version: version
                },
                domainId
            });

            const eventResults = handleCommonEvents(events, proofOptions.proofType, TransactionType.Verify, withAggregation);

            console.log(
                `[RESULT RECEIVED] ${accountAddress} ${proofOptions.proofType}` +
                (version ? `:${version}` : '') +
                ` Transaction result received. Validating...`
            );

            const transactionInfo: VerifyTransactionInfo = await transactionResult;
            console.log(
                `[VALIDATING] ${accountAddress} ${proofOptions.proofType}` +
                (version ? `:${version}` : '') +
                ` validateVerifyTransactionInfo`
            );
            validateVerifyTransactionInfo(transactionInfo, proofOptions.proofType, withAggregation);
            console.log(
                `[VALIDATING] ${accountAddress} ${proofOptions.proofType}` +
                (version ? `:${version}` : '') +
                ` validateEventResults`
            );
            validateEventResults(eventResults);

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
        TransactionType.VKRegistration
    );

    const vkTransactionInfo: VKRegistrationTransactionInfo = await registerTransactionResult;
    validateVKRegistrationTransactionInfo(vkTransactionInfo, proofOptions.proofType);
    validateEventResults(registerResults);

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