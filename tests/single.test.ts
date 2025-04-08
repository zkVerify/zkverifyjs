import {ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession} from '../src';
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
            const expectAggregation = true;
            [envVar, wallet] = await walletPool.acquireWallet();
            const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk });

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const { events, transactionResult } = await session.verify().ultraplonk().execute({
                proofData: {
                    proof: proofData.proof.proof,
                    publicSignals: proofData.proof.publicSignals,
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

            validateVerifyTransactionInfo(transactionInfo, 'ultraplonk', expectAggregation)

            //TODO:  Add publish aggregation and check for NewAggregationReceipt.
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}`);
            } else {
                throw new Error('Test failed with an unknown error');
            }
        }
    });
});
