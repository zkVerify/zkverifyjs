import { CurveType, Library, ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession } from '../src';
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

    it('should send a provided extrinsic and verify the proof', async () => {
        try {
            console.log('🧪 Starting test: should verify a provided extrinsic');

            [envVar, wallet] = await walletPool.acquireWallet();

            const proofData = loadProofAndVK({
                proofType: ProofType.groth16,
                config: {
                    curve: CurveType.bn254,
                    library: Library.snarkjs
                }
            });

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const proofOptions = {
                proofType: ProofType.groth16,
                config: {
                    curve: CurveType.bn254,
                    library: Library.snarkjs
                }
            }

            const formattedProof = await session.format(
                proofOptions,
                proofData.proof.proof,
                proofData.proof.publicSignals,
                proofData.vk
            )

            const submittableExtrinsic = await session.createSubmitProofExtrinsic(
                ProofType.groth16,
                formattedProof,
                0)

            const { events, transactionResult } = await session
                .verify()
                .groth16({
                    curve: CurveType.bn254,
                    library: Library.snarkjs
                })
                .execute({
                    extrinsic: submittableExtrinsic
                });

            const results = handleCommonEvents(
                events,
                'groth16',
                TransactionType.Verify,
                true
            );

            const transactionInfo: VerifyTransactionInfo = await transactionResult;

            expect(results.includedInBlockEmitted).toBe(true);
            expect(results.finalizedEmitted).toBe(true);
            expect(results.errorEventEmitted).toBe(false);

            console.log('🔍 Validating transaction info...');
            validateVerifyTransactionInfo(transactionInfo, 'groth16', true);
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
