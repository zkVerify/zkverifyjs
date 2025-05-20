import { ProofType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import {
    loadProofAndVK,
    performHoldDomain,
    performRegisterDomain,
    performUnregisterDomain,
    validateAggregateStatementPathResult
} from "./common/utils";
import { AggregateSecurityRules, Destination, ZkVerifyEvents } from "../src";
import { createEventTracker } from "./common/eventHandlers";

jest.setTimeout(300000);
describe('Domain interaction tests', () => {
    let session: zkVerifySession;
    let wallet: string | null = null;
    let envVar: string | null = null;

    beforeEach(async () => {
        wallet = null;
        envVar = null;
    });

    afterEach(async () => {
        if (session) {
            await session.close();
            expect(session.api.isConnected).toBe(false);
            expect(session['provider'].isConnected).toBe(false);
        }
        if (envVar) {
            await walletPool.releaseWallet(envVar);
        }
    });

    it.skip('should error when attempting to register, unregister or hold a domain in a readOnly session', async () => {
        session = await zkVerifySession.start().Volta().readOnly();

        try {
            await session.registerDomain(1, 1, { destination: Destination.None, aggregateRules: AggregateSecurityRules.Untrusted }).transactionResult;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }

        try {
            await session.unregisterDomain(9999999992).transactionResult;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }

        try {
            await session.holdDomain(9999993).transactionResult;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }
    });

    it('should register, hold, and unregister a domain', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const accountInfo = await session.getAccountInfo();
        console.log(`Running Test: 'should register, hold, and unregister a domain' with Account: ${accountInfo[0].address}`)

        const expectedEvents = [
            ZkVerifyEvents.NewDomain,
            ZkVerifyEvents.ProofVerified,
            ZkVerifyEvents.NewProof,
            ZkVerifyEvents.NewAggregationReceipt,
            ZkVerifyEvents.DomainStateChanged,
        ];

        const { receivedEvents, attachListeners } = createEventTracker();

        const emitter = session.subscribe();
        attachListeners(emitter, expectedEvents);

        const domainId = await performRegisterDomain(session, 2, 1, { destination: Destination.None, aggregateRules: AggregateSecurityRules.Untrusted});

        const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk, config: {
            numberOfPublicInputs: 1
            } });

        const { transactionResult } = await session.verify().ultraplonk({
            numberOfPublicInputs: 1
        }).execute({
            proofData: {
                proof: proofData.proof.proof,
                vk: proofData.vk,
            },
            domainId,
        });

        const txInfo = await transactionResult;
        expect(txInfo.domainId).toBeDefined();
        expect(txInfo.aggregationId).toBeDefined();

        const { events, transactionResult: aggregateTransactionResult } = session.aggregate(txInfo.domainId!, txInfo.aggregationId!);
        const aggregationReceipt = await session.waitForAggregationReceipt(txInfo.domainId!, txInfo.aggregationId!);

        await aggregateTransactionResult;

        console.log("Getting the statement path!!")
        const result = await session.getAggregateStatementPath(aggregationReceipt.blockHash!, txInfo.domainId!, txInfo.aggregationId!, txInfo.statement!);
        console.log("PATH IS: " + JSON.stringify(result));
        validateAggregateStatementPathResult(result);
        console.log("VALIDATED!!");

        await performHoldDomain(session, domainId, true);
        await performUnregisterDomain(session, domainId);

        for (const eventType of expectedEvents) {
            if (!receivedEvents[eventType]) {
                console.error(`❌ No events received for event type: ${eventType}`);
            } else if (!Array.isArray(receivedEvents[eventType])) {
                console.error(`❌ Expected receivedEvents[${eventType}] to be an array but got:`, receivedEvents[eventType]);
            } else if (receivedEvents[eventType].length === 0) {
                console.error(`❌ No events found in the array for event type: ${eventType}`);
            } else {
                console.debug(`✅ Received ${receivedEvents[eventType].length} events for ${eventType}`);
            }

            expect(Array.isArray(receivedEvents[eventType])).toBe(true);
            expect(receivedEvents[eventType].length).toBeGreaterThan(0);


            receivedEvents[eventType].forEach((payload, index) => {
                switch (eventType) {
                    case ZkVerifyEvents.NewDomain:
                        expect(payload.data.id).toBeDefined();

                        const domainId = Number(payload.data.id);
                        expect(domainId).toBeDefined();
                        expect(typeof domainId).toBe('number');
                        expect(domainId).toBeGreaterThan(0);
                        break;

                    case ZkVerifyEvents.ProofVerified:
                        expect(payload.data.statement).toBeDefined();
                        expect(typeof payload.data.statement).toBe('string');
                        break;

                    case ZkVerifyEvents.NewProof:
                        expect(payload.data.statement).toBeDefined();
                        expect(typeof payload.data.statement).toBe('string');
                        expect(payload.data.domainId).toBeDefined();
                        expect(payload.data.aggregationId).toBeDefined();
                        break;

                    case ZkVerifyEvents.NewAggregationReceipt:
                        expect(payload.blockHash).toBeDefined();
                        expect(payload.data.domainId).toBeDefined();
                        expect(payload.data.aggregationId).toBeDefined();
                        expect(payload.data.receipt).toBeDefined();
                        break;

                    case ZkVerifyEvents.DomainStateChanged:
                        expect(payload.data.id).toBeDefined();
                        expect(payload.data.state).toBeDefined();
                        expect(['Hold', 'Removable', 'Removed']).toContain(payload.data.state);
                        break;

                    default:
                        throw new Error(`Unhandled event type in test: ${eventType}`);
                }
            });
        }
    });
});
