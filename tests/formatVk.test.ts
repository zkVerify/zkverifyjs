import { ProofType, zkVerifySession } from '../src';
import { CurveType, Library } from '../src';
import { loadVerificationKey } from './common/utils';
import { walletPool } from './common/walletPool';

jest.setTimeout(60000);

describe('zkVerifySession - formatVk integration', () => {
    let session: zkVerifySession;
    let wallet: string;
    let envVar: string;

    const proofOptions = {
        proofType: ProofType.groth16,
        config: {
            curve: CurveType.bls12381,
            library: Library.snarkjs,
        },
    };

    beforeAll(async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);
    });

    afterAll(async () => {
        await session.close();
        await walletPool.releaseWallet(envVar);
    });

    it('should format a valid verification key without throwing', async () => {
        const vk = loadVerificationKey(proofOptions);

        const result = await session.formatVk(proofOptions, vk);

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });
});
