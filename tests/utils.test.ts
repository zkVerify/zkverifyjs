import { CurveType, ExtrinsicCostEstimate, Library, ProofType, zkVerifySession } from '../src';
import path from "path";
import fs from "fs";
import { walletPool } from './common/walletPool';

jest.setTimeout(180000);

describe('zkVerifySession - estimateCost', () => {
    let session: zkVerifySession;
    let wallet: string;
    let envVar: string;

    beforeAll(async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);
    });

    afterAll(async () => {
        await session.close();
        await walletPool.releaseWallet(envVar);
    });

    async function getTestExtrinsic() {
        const dataPath = path.join(__dirname, 'common/data', 'groth16_snarkjs_bn128.json');
        const groth16Data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        const formattedProofData = await session.format(
            { proofType: ProofType.groth16, library: Library.snarkjs, curve: CurveType.bn128 },
            groth16Data.proof,
            groth16Data.publicSignals,
            groth16Data.vk
        );
        return session.createSubmitProofExtrinsic(ProofType.groth16, formattedProofData);
    }

    it('should format proof data, create a SubmittableExtrinsic and then estimate the cost of the submitProof extrinsic', async () => {
        const extrinsic = await getTestExtrinsic();

        try {
            const costEstimate: ExtrinsicCostEstimate = await session.estimateCost(extrinsic);
            expect(costEstimate).toBeDefined();
            expect(costEstimate).toHaveProperty('partialFee');
            expect(costEstimate).toHaveProperty('estimatedFeeInTokens');
            expect(costEstimate).toHaveProperty('weight');
            expect(costEstimate).toHaveProperty('length');

            expect(parseFloat(costEstimate.estimatedFeeInTokens)).toBeGreaterThan(0);
        } catch (error) {
            console.error('Error estimating cost:', error);
            throw error;
        }
    });

    it('should throw an error when estimating cost in a read-only session', async () => {
        const extrinsic = await getTestExtrinsic();
        const readOnlySession = await zkVerifySession.start().Testnet().readOnly();

        try {
            await expect(readOnlySession.estimateCost(extrinsic)).rejects.toThrow(
                'This action requires an active account'
            );
        } finally {
            await readOnlySession.close();
        }
    });
});
