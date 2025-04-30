import { CurveType, Library, ProofType, TransactionType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK, validateBatchVerifyTransactionInfo } from './common/utils';
import { handleCommonEvents } from './common/eventHandlers';
import { BatchVerifyTransactionInfo } from '../src';

jest.setTimeout(120000);

describe('zkVerifySession batch verify', () => {
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

    it('should send multiple proofs in a batch and finalize successfully', async () => {
        try {
            console.log('Starting batch test: sending multiple proofs');

            const expectAggregation = true;

            console.log('Acquiring wallet...');
            [envVar, wallet] = await walletPool.acquireWallet();
            console.log(`Wallet acquired: ${wallet}`);

            console.log('Loading proof and VK...');
            const proofData = loadProofAndVK({
                proofType: ProofType.groth16,
                config: {
                    library: Library.snarkjs,
                    curve: CurveType.bn254,
                },
            });
            console.log('Proof and VK loaded');

            console.log('Initializing session...');
            session = await zkVerifySession.start().Volta().withAccount(wallet);
            console.log('Session started');

            console.log('Sending batch of proofs for verification...');
            const { events, transactionResult } = await session
                .batchVerify()
                .groth16({
                    library: Library.snarkjs,
                    curve: CurveType.bn254,
                })
                .execute([
                    {
                        proofData: {
                            proof: proofData.proof.proof,
                            publicSignals: proofData.proof.publicSignals,
                            vk: proofData.vk,
                        },
                        domainId: 0,
                    },
                    {
                        proofData: {
                            proof: proofData.proof.proof,
                            publicSignals: proofData.proof.publicSignals,
                            vk: proofData.vk,
                        },
                        domainId: 0,
                    },
                ]);
            console.log('Batch proofs submitted, processing events');

            const results = handleCommonEvents(
                events,
                'groth16',
                TransactionType.BatchVerify,
                expectAggregation,
            );

            console.log('Awaiting transaction result...');
            const transactionInfo: BatchVerifyTransactionInfo = await transactionResult;
            console.log('Transaction finalized');

            expect(results.includedInBlockEmitted).toBe(true);
            expect(results.finalizedEmitted).toBe(true);
            expect(results.errorEventEmitted).toBe(false);

            console.log('Validating transaction info...');
            validateBatchVerifyTransactionInfo(transactionInfo, 'groth16');
            console.log('Batch test complete');
        } catch (error: unknown) {
            console.error('Batch test failed. Error:', error);
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}\nStack: ${error.stack}`);
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                throw new Error(`Test failed with error object: ${(error as any).message}`);
            } else {
                throw new Error(`Test failed with unknown error: ${JSON.stringify(error)}`);
            }
        }
    });

    it('should throw an error if a proof in the batch is invalid (e.g. 2nd proof fails)', async () => {
        console.log('Starting batch test: 2nd proof is invalid');

        [envVar, wallet] = await walletPool.acquireWallet();

        const proofData = loadProofAndVK({
            proofType: ProofType.groth16,
            config: {
                library: Library.snarkjs,
                curve: CurveType.bn254,
            },
        });

        const invalidProof = '0x0';

        session = await zkVerifySession.start().Volta().withAccount(wallet);

        try {
            const { events, transactionResult } = await session
                .batchVerify()
                .groth16({
                    library: Library.snarkjs,
                    curve: CurveType.bn254,
                })
                .execute([
                    {
                        proofData: {
                            proof: proofData.proof.proof,
                            publicSignals: proofData.proof.publicSignals,
                            vk: proofData.vk,
                        },
                        domainId: 0,
                    },
                    {
                        proofData: {
                            proof: invalidProof,
                            publicSignals: proofData.proof.publicSignals,
                            vk: proofData.vk,
                        },
                        domainId: 0,
                    },
                ]);

            await transactionResult;

            throw new Error('Expected batch verify to throw, but it succeeded');
        } catch (err) {
            const message =
                err instanceof Error ? err.message : JSON.stringify(err);

            expect(message).toContain('batch index 1');
            expect(message.toLowerCase()).toContain('failed to format');
        }
    });

});
