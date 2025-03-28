import {ProofType, zkVerifySession} from '../src';
import { walletPool } from './common/walletPool';
import {loadProofAndVK, performHoldDomain, performRegisterDomain, performUnregisterDomain} from "./common/utils";
import { AggregateSecurityRules, Destination, ZkVerifyEvents } from "../src";
import {createEventTracker} from "./common/eventHandlers";

jest.setTimeout(120000);
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

        const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk });

        const { transactionResult } = await session.verify().ultraplonk().execute({
            proofData: {
                proof: proofData.proof.proof,
                publicSignals: proofData.proof.publicSignals,
                vk: proofData.vk,
            },
            domainId,
        });
        console.log("Awaiting Verify Transaction Result.")
        const txInfo = await transactionResult;
        console.log("Verify Transaction Result Complete.")

        expect(txInfo.domainId).toBeDefined();
        expect(txInfo.aggregationId).toBeDefined();
        console.log(`domainId: ${txInfo.domainId}`)
        console.log(`aggregationId: ${txInfo.aggregationId}`)

        console.log("Awaiting Aggregate Transaction Result.")
        const { events, transactionResult: aggregateTransactionResult } = session.aggregate(txInfo.domainId!, txInfo.aggregationId!);

        await aggregateTransactionResult;
        console.log("Aggregate Transaction Result: SUCCESS")

        await performHoldDomain(session, domainId, true);
        await performUnregisterDomain(session, domainId);

        for (const eventType of expectedEvents) {
            expect(receivedEvents[eventType]?.length).toBeGreaterThan(0);

            receivedEvents[eventType].forEach((payload, index) => {
                console.log(`Payload #${index + 1} for ${eventType}:`, payload);

                switch (eventType) {
                    case ZkVerifyEvents.NewDomain:
                        expect(payload.domainId).toBeDefined();
                        expect(typeof payload.domainId).toBe('number');
                        break;

                    case ZkVerifyEvents.ProofVerified:
                        expect(payload.statement).toBeDefined();
                        expect(typeof payload.statement).toBe('string');
                        break;

                    case ZkVerifyEvents.NewProof:
                        expect(payload.statement).toBeDefined();
                        expect(typeof payload.statement).toBe('string');
                        expect(payload.domainId).toBeDefined();
                        expect(payload.aggregationId).toBeDefined();
                        break;

                    case ZkVerifyEvents.NewAggregationReceipt:
                        expect(payload.domainId).toBeDefined();
                        expect(payload.aggregationId).toBeDefined();
                        expect(payload.receipt).toBeDefined();
                        break;

                    case ZkVerifyEvents.DomainStateChanged:
                        expect(payload.domainId).toBeDefined();
                        expect(payload.domainState).toBeDefined();
                        expect(['Hold', 'Removable']).toContain(payload.domainState);
                        break;

                    default:
                        throw new Error(`Unhandled event type in test: ${eventType}`);
                }
            });
        }
    });
});
