import { CurveType, Library, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import * as path from 'path';
import * as fs from 'fs/promises';

jest.setTimeout(240000);

describe('zkVerifySession.registerVerificationKey error handling', () => {
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

    it('should throw an error when registering an already registered verification key', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();

        const vkPath = path.resolve(__dirname, 'common/data/verificationKeys', 'groth16_gnark_bn254_vk.json');
        const alreadyRegisteredVk = JSON.parse(await fs.readFile(vkPath, 'utf-8'));

        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const registerAgain = async () => {
            const { transactionResult } = await session
                .registerVerificationKey()
                .groth16({
                    curve: CurveType.bn254,
                    library: Library.gnark,
                })
                .execute(alreadyRegisteredVk);

            await transactionResult;
        };

        await expect(registerAgain()).rejects.toThrow(/Verification key has already been registered/i);
    });
});
