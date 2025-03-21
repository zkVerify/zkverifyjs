import { zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK } from "./common/utils";
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
            // if (domainId) {
            //     await session.holdDomain(domainId).result
            //     await session.unregisterDomain(domainId).result
            // }
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
            [envVar, wallet] = await walletPool.acquireWallet();
            const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk });

            session = await zkVerifySession.start().Testnet().withAccount(wallet);

            domainId = await session.registerDomain(1, 1).domainIdPromise;

            const { transactionResult } = await session.verify().ultraplonk().execute({
                proofData: {
                    proof: proofData.proof.proof,
                    publicSignals: proofData.proof.publicSignals,
                    vk: proofData.vk
                },
                domainId
            });

            await transactionResult;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}`);
            } else {
                throw new Error('Test failed with an unknown error');
            }
        }
    });
});
