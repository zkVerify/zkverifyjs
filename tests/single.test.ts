import {
    CurveType,
    Library,
    ProofType,
    TransactionType,
    VerifyTransactionInfo,
    zkVerifySession,
} from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK, validateVerifyTransactionInfo } from './common/utils';
import { handleCommonEvents } from './common/eventHandlers';

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

    it('should send a proof to a registered domain and get aggregation', async () => {
        try {
            const expectAggregation = true;

            [envVar, wallet] = await walletPool.acquireWallet();

            const proofData = loadProofAndVK({
                proofType: ProofType.ultrahonk,
            });

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const { events, transactionResult } = await session
                .verify()
                .ultrahonk()
                .execute({
                    proofData: {
                        proof: proofData.proof.proof,
                        publicSignals: proofData.proof.publicSignals,
                        vk: proofData.vk,
                    },
                    domainId: 0,
                });

            const results = handleCommonEvents(
                events,
                'ultrahonk',
                TransactionType.Verify,
                expectAggregation
            );

            const transactionInfo: VerifyTransactionInfo = await transactionResult;

            validateVerifyTransactionInfo(transactionInfo, 'ultrahonk', expectAggregation);
        } catch (error: unknown) {
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
