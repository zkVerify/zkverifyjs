import {NewAggregationReceipt, TransactionStatus, VerifyTransactionInfo, ZkVerifyEvents, zkVerifySession} from '../src';
import { walletPool } from './common/walletPool';
import {
    loadProofAndVK,
} from "./common/utils";
import { ProofType } from "../src";

jest.setTimeout(120000);
describe('zkVerifySession class', () => {
    let session: zkVerifySession;
    let domainId: number | undefined;
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

    it.skip('should subscribe to NewAggregationReceipt events', async () => {
        try {
            const expectAggregation = true;
            [envVar, wallet] = await walletPool.acquireWallet();
            const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk });

            const domainId = 1;
            let aggregationId: number | undefined;
            let receipt: NewAggregationReceipt | undefined;

            // Start session
            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const { events, transactionResult } = await session.verify().ultraplonk().execute({
                proofData: {
                    proof: proofData.proof.proof,
                    publicSignals: proofData.proof.publicSignals,
                    vk: proofData.vk,
                },
                domainId,
            });

            events.on(ZkVerifyEvents.IncludedInBlock, (eventData: any) => {
                aggregationId = eventData.aggregationId;
            });

            session.subscribe(
                (newAggregationReceipt: NewAggregationReceipt) => {
                    console.log('✅ Aggregation receipt received:', newAggregationReceipt);
                    receipt = newAggregationReceipt;
                },
                { domainId, aggregationId }
            );

            const transactionInfo = await transactionResult;

            // Do something with transactionInfo and receipt
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}`);
            } else {
                throw new Error('Test failed with an unknown error');
            }
        }
    });
});
