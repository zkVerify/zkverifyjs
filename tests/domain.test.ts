import { ProofType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import {
    loadProofAndVK,
    performHoldDomain,
    performRegisterDomain,
    performUnregisterDomain,
    validateAggregateStatementPathResult
} from "./common/utils";
import { AggregateSecurityRules, Destination, ProofSecurityRules, ZkVerifyEvents } from "../src";
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
            await session.registerDomain(1, 1, { destination: Destination.None, aggregateRules: AggregateSecurityRules.Untrusted, proofSecurityRules: ProofSecurityRules.Untrusted }).transactionResult;
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

    it('should register, hold, and unregister a domain with ProofSecurityRules Untrusted', async () => {
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

        const domainId = await performRegisterDomain(session, 2, 1, { destination: Destination.None, aggregateRules: AggregateSecurityRules.Untrusted, proofSecurityRules: ProofSecurityRules.Untrusted});

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

    it('should add and remove domain submitters on allowlist (v1.3.0+)', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const accountInfo = await session.getAccountInfo();
        const testAccount = accountInfo[0].address;

        console.log('\nRegistering domain with OnlyAllowlisted proof security...');
        const domainId = await performRegisterDomain(
            session,
            2,
            1,
            {
                destination: Destination.None,
                aggregateRules: AggregateSecurityRules.Untrusted,
                proofSecurityRules: ProofSecurityRules.OnlyAllowlisted,
            },
        );

        console.log(`Domain ${domainId} registered with OnlyAllowlisted security`);

        const proofData = loadProofAndVK({
            proofType: ProofType.ultraplonk,
            config: {
                numberOfPublicInputs: 1
            }
        });

        console.log('Step 1: Try to submit proof before adding to allowlist (should fail)...');
        try {
            const { transactionResult: failResult1 } = await session.verify().ultraplonk({
                numberOfPublicInputs: 1
            }).execute({
                proofData: {
                    proof: proofData.proof.proof,
                    vk: proofData.vk,
                },
                domainId,
            });
            await failResult1;
            fail('Expected proof submission to fail when not on allowlist');
        } catch (error) {
            console.log('Proof submission correctly rejected (not on allowlist)');
            expect(error).toBeDefined();
        }

        const submitters = [testAccount];

        console.log('\nStep 2: Adding submitters to allowlist...');
        const { transactionResult: addResult } = session.addDomainSubmitters(
            domainId,
            submitters,
        );

        const addTxInfo = await addResult;
        expect(addTxInfo.status).toBe('finalized');
        console.log('Submitters added successfully');

        console.log('\nStep 3: Submit proof after adding to allowlist (should succeed)...');
        const { transactionResult: submitResult } = await session.verify().ultraplonk({
            numberOfPublicInputs: 1
        }).execute({
            proofData: {
                proof: proofData.proof.proof,
                vk: proofData.vk,
            },
            domainId,
        });

        const submitTxInfo = await submitResult;
        expect(submitTxInfo.domainId).toBe(domainId);
        console.log('Proof submission succeeded (on allowlist)');

        console.log('\nStep 4: Removing only submitter from allowlist...');
        const { transactionResult: removeResult, events: removeEvents } = session.removeDomainSubmitters(
            domainId,
            submitters,
        );

        const removeTxInfo = await removeResult;
        expect(removeTxInfo.status).toBe('finalized');
        console.log(`Submitters removed successfully.`);

        console.log('\nStep 5: Try to submit proof after removal (should fail)...');
        try {
            const { transactionResult: failResult2 } = await session.verify().ultraplonk({
                numberOfPublicInputs: 1
            }).execute({
                proofData: {
                    proof: proofData.proof.proof,
                    vk: proofData.vk,
                },
                domainId,
            });
            await failResult2;
            fail('Expected proof submission to fail after being removed from allowlist');
        } catch (error) {
            console.log('Proof submission correctly rejected (removed from allowlist)');
            expect(error).toBeDefined();
        }

        const { events, transactionResult: aggregateTransactionResult } = session.aggregate(submitTxInfo.domainId!, submitTxInfo.aggregationId!);
        await session.waitForAggregationReceipt(submitTxInfo.domainId!, submitTxInfo.aggregationId!);

        await aggregateTransactionResult;

        console.log('Unregistering Domain...')
        await performUnregisterDomain(session, domainId);

        console.log('\nAllowlist workflow test completed successfully!');
    });

    it('should enforce OnlyOwner proof security rules (v1.3.0+)', async () => {
        let envVar2: string | null = null;
        let wallet2: string | null = null;

        try {
            [envVar, wallet] = await walletPool.acquireWallet();
            [envVar2, wallet2] = await walletPool.acquireWallet();

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const accountInfo = await session.getAccountInfo();
            const ownerAccount = accountInfo[0].address;

            console.log('\nRegistering domain with OnlyOwner proof security...');
            const domainId = await performRegisterDomain(
                session,
                2,
                1,
                {
                    destination: Destination.None,
                    aggregateRules: AggregateSecurityRules.Untrusted,
                    proofSecurityRules: ProofSecurityRules.OnlyOwner,
                },
            );

            console.log(`Domain ${domainId} registered with OnlyOwner security by ${ownerAccount}`);

            const nonOwnerAddress = await session.addAccount(wallet2);
            console.log(`Added non-owner account: ${nonOwnerAddress}`);

            const proofData = loadProofAndVK({
                proofType: ProofType.ultraplonk,
                config: {
                    numberOfPublicInputs: 1
                }
            });

            console.log('\nStep 1: Try to submit proof with non-owner account (should fail)...');
            try {
                const { transactionResult: failResult } = await session.verify(nonOwnerAddress).ultraplonk({
                    numberOfPublicInputs: 1
                }).execute({
                    proofData: {
                        proof: proofData.proof.proof,
                        vk: proofData.vk,
                    },
                    domainId,
                });
                await failResult;
                fail('Expected proof submission to fail from non-owner account');
            } catch (error) {
                console.log('Proof submission correctly rejected (not owner)');
                expect(error).toBeDefined();
            }

            console.log('\nStep 2: Submit proof with owner account (should succeed)...');
            const { transactionResult: successResult } = await session.verify(ownerAccount).ultraplonk({
                numberOfPublicInputs: 1
            }).execute({
                proofData: {
                    proof: proofData.proof.proof,
                    vk: proofData.vk,
                },
                domainId,
            });

            const successTxInfo = await successResult;
            expect(successTxInfo.domainId).toBe(domainId);
            expect(successTxInfo.status).toBe('finalized');
            console.log('Proof submission succeeded (owner account)');

            const { events, transactionResult: aggregateTransactionResult } = session.aggregate(successTxInfo.domainId!, successTxInfo.aggregationId!);
            await session.waitForAggregationReceipt(successTxInfo.domainId!, successTxInfo.aggregationId!);

            await aggregateTransactionResult;

            console.log('Holding Domain...')
            await performHoldDomain(session, domainId, true);
            console.log('Unregistering Domain...')
            await performUnregisterDomain(session, domainId);

            console.log('\nOnlyOwner security test completed successfully!');
        } finally {
            if (envVar2) {
                await walletPool.releaseWallet(envVar2);
            }
        }
    });
});
