import { Plonky2HashFunction, ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK, validateVerifyTransactionInfo } from "./common/utils";
import { handleCommonEvents } from "./common/eventHandlers";

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
    it('should send a proof to a registered domain and get aggregation', async () => {
        try {
            console.log('🧪 Starting test: should send a proof to a registered domain and get aggregation');

            const expectAggregation = true;

            [envVar, wallet] = await walletPool.acquireWallet();

            const proofData = loadProofAndVK({
                proofType: ProofType.ultraplonk,
                config: {
                    numberOfPublicInputs: 1
                }
            });

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const { events, transactionResult } = await session
                .verify()
                .ultraplonk({
                    numberOfPublicInputs: 1
                })
                .execute({
                    proofData: {
                        proof: proofData.proof.proof,
                        publicSignals: proofData.proof.proof,
                        vk: proofData.vk,
                    },
                    domainId: 0,
                });

            const results = handleCommonEvents(
                events,
                'ultraplonk',
                TransactionType.Verify,
                expectAggregation
            );

            const transactionInfo: VerifyTransactionInfo = await transactionResult;

            expect(results.includedInBlockEmitted).toBe(true);
            expect(results.finalizedEmitted).toBe(true);
            expect(results.errorEventEmitted).toBe(false);

            console.log('🔍 Validating transaction info...');
            validateVerifyTransactionInfo(transactionInfo, 'ultraplonk', expectAggregation);
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
