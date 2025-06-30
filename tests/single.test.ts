import {CurveType, Library, ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession,} from '../src';
import {walletPool} from './common/walletPool';
import {loadProofAndVK, validateVerifyTransactionInfo} from './common/utils';
import {handleCommonEvents} from './common/eventHandlers';

jest.setTimeout(120000);

describe('zkVerifySession class', () => {
    let session: zkVerifySession;
    let wallet: string | null = null;
    let envVar: string | null = null;

    beforeEach(async () => {
        console.log('🔄 beforeEach: Resetting wallet and envVar');
        wallet = null;
        envVar = null;
    });

    afterEach(async () => {
        console.log('🧹 afterEach: Cleaning up session and wallet');
        if (session) {
            console.log('📴 Closing zkVerifySession...');
            await session.close();
            console.log('✅ zkVerifySession closed');
            expect(session.api.isConnected).toBe(false);
            expect(session['provider'].isConnected).toBe(false);
        }
        if (envVar) {
            console.log('📤 Releasing wallet:', envVar);
            await walletPool.releaseWallet(envVar);
            console.log('✅ Wallet released');
        }
    });

    it('should send a proof to a registered domain and get aggregation', async () => {
        try {
            console.log('🧪 Starting test: should send a proof to a registered domain and get aggregation');
            const expectAggregation = true;

            console.log('🔐 Acquiring wallet...');
            [envVar, wallet] = await walletPool.acquireWallet();
            console.log('✅ Wallet acquired:', wallet);

            console.log('📦 Loading proof and VK...');
            const proofData = loadProofAndVK({
                proofType: ProofType.groth16,
                config: {
                    library: Library.gnark,
                    curve: CurveType.bn254
                },
            });
            console.log('✅ Loaded proof and VK');

            console.log('🚀 Starting zkVerifySession...');
            session = await zkVerifySession.start().Volta().withAccount(wallet);
            console.log('✅ zkVerifySession started');

            console.log('📨 Executing .verify().groth16()...');
            const { events, transactionResult } = await session
                .verify()
                .groth16({
                    library: Library.gnark,
                    curve: CurveType.bls12381
                })
                .execute({
                    proofData: {
                        proof: proofData.proof.proof,
                        publicSignals: proofData.proof.publicSignals,
                        vk: proofData.vk,
                    },
                    domainId: 0,
                });
            console.log('✅ Proof submitted, received events');

            console.log('📊 Handling common events...');
            const results = handleCommonEvents(
                events,
                'groth16',
                TransactionType.Verify,
                expectAggregation
            );
            console.log('✅ Event results:', results);

            console.log('📥 Awaiting transaction result...');
            const transactionInfo: VerifyTransactionInfo = await transactionResult;
            console.log('✅ Transaction result received:', transactionInfo);

            console.log('🔍 Validating transaction info...');
            validateVerifyTransactionInfo(transactionInfo, 'groth16', expectAggregation);
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
