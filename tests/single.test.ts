import {Plonky2HashFunction, ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession} from '../src';
import {walletPool} from './common/walletPool';
import {loadProofAndVK, validateVerifyTransactionInfo} from "./common/utils";
import {handleCommonEvents} from "./common/eventHandlers";

jest.setTimeout(120000);
describe('zkVerifySession class', () => {
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

    // Just used for local testing a single proof easily.
    it.skip('should send a proof to a registered domain and get aggregation', async () => {
        try {
            console.log('🧪 Starting test: should send a proof to a registered domain and get aggregation');

            const expectAggregation = true;

            console.log('🔐 Acquiring wallet...');
            [envVar, wallet] = await walletPool.acquireWallet();
            console.log(`✅ Wallet acquired: ${wallet}`);

            console.log('📦 Loading proof and VK...');
            const proofData = loadProofAndVK({
                proofType: ProofType.plonky2,
                config: {
                    compressed: false,
                    hashFunction: Plonky2HashFunction.Poseidon
                }
            });
            console.log(JSON.stringify(proofData));
            console.log('✅ Proof and VK loaded');
            const proofString = proofData.proof.proof;
            const charCount = proofString.length;

            console.log(`Proof string length: ${charCount} characters`);

            console.log('⚙️  Initializing session...');
            session = await zkVerifySession.start().Volta().withAccount(wallet);
            console.log('✅ Session started');

            console.log('🚀 Sending proof for verification...');
            const { events, transactionResult } = await session
                .verify()
                .plonky2({
                    compressed: false,
                    hashFunction: Plonky2HashFunction.Poseidon
                })
                .execute({
                    proofData: {
                        proof: proofData.proof.proof,
                        publicSignals: proofData.proof.publicSignals,
                        vk: proofData.vk,
                    },
                    domainId: 0,
                });
            console.log('✅ Proof submitted, processing events');

            const results = handleCommonEvents(
                events,
                'plonky2',
                TransactionType.Verify,
                expectAggregation
            );

            console.log('📦 Awaiting transaction result...');
            const transactionInfo: VerifyTransactionInfo = await transactionResult;
            console.log('✅ Transaction finalized');

            expect(results.includedInBlockEmitted).toBe(true);
            expect(results.finalizedEmitted).toBe(true);
            expect(results.errorEventEmitted).toBe(false);

            console.log('🔍 Validating transaction info...');
            validateVerifyTransactionInfo(transactionInfo, 'plonky2', expectAggregation);
            console.log('✅ Test complete');
        } catch (error: unknown) {
            console.error('❌ Test failed. Error:', error);
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}\nStack: ${error.stack}`);
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                throw new Error(`Test failed with error object: ${(error as any).message}`);
            } else {
                throw new Error(`Test failed with unknown error: ${JSON.stringify(error)}`);
            }
        }
    });

});
