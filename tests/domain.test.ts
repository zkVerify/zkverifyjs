import {ProofType, zkVerifySession} from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK, performHoldDomain, performRegisterDomain, performUnregisterDomain } from "./common/utils";
import { AggregateSecurityRules, Destination, ZkVerifyEvents } from "../src";
import { createEventTracker } from "./common/eventHandlers";

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

    it('should error when attempting to register, unregister or hold a domain in a readOnly session', async () => {
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

        const txInfo = await transactionResult;
        expect(txInfo.domainId).toBeDefined();
        expect(txInfo.aggregationId).toBeDefined();

        const { events, transactionResult: aggregateTransactionResult } = session.aggregate(txInfo.domainId!, txInfo.aggregationId!);

        await aggregateTransactionResult;
        await performHoldDomain(session, domainId, true);
        await performUnregisterDomain(session, domainId);

        for (const eventType of expectedEvents) {
            expect(receivedEvents[eventType]?.length).toBeGreaterThan(0);

            receivedEvents[eventType].forEach((payload, index) => {
                console.debug(`Payload #${index + 1} for ${eventType}:`, payload);
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
