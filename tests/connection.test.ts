import { zkVerifySession } from '../src';
import { AccountInfo } from "../src";
import { walletPool } from './common/walletPool';

jest.setTimeout(120000);

describe('zkVerifySession - accountInfo', () => {
    let wallet: string | undefined;
    let envVar: string | undefined;

    afterEach(async () => {
        if (envVar) {
            await walletPool.releaseWallet(envVar);
            envVar = undefined
            wallet = undefined;
        }
    });

    it('should retrieve the account info including address, nonce, free balance and reserved balance', async () => {
        let session: zkVerifySession | undefined;

        try {
            [envVar, wallet] = await walletPool.acquireWallet();
            session = await zkVerifySession.start().Testnet().withAccount(wallet);

            const accountInfo: AccountInfo = await session.accountInfo;
            expect(accountInfo).toBeDefined();

            expect(accountInfo.address).toBeDefined();
            expect(typeof accountInfo.address).toBe('string');

            expect(accountInfo.nonce).toBeDefined();
            expect(typeof accountInfo.nonce).toBe('number');
            expect(accountInfo.nonce).toBeGreaterThanOrEqual(0);

            expect(accountInfo.freeBalance).toBeDefined();
            expect(typeof accountInfo.freeBalance).toBe('string');
            expect(parseFloat(accountInfo.freeBalance)).toBeGreaterThanOrEqual(0);

            expect(accountInfo.reservedBalance).toBeDefined();
            expect(typeof accountInfo.reservedBalance).toBe('string');
            expect(parseFloat(accountInfo.reservedBalance)).toBeGreaterThanOrEqual(0);
        } catch (error) {
            console.error('Error fetching account info:', error);
            throw error;
        } finally {
            if (session) {
                await session.close();
            }
        }
    });

    it('should handle adding and removing accounts and throw an error if trying to get account info in a read-only session', async () => {
        let session: zkVerifySession | undefined;

        try {
            [envVar, wallet] = await walletPool.acquireWallet();
            session = await zkVerifySession.start().Testnet().readOnly();
            await expect(session.accountInfo).rejects.toThrow(
                'This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.'
            );

            session.addAccount(wallet);
            const accountInfo = await session.accountInfo;
            expect(accountInfo).toBeDefined();
            expect(accountInfo.address).toBeDefined();
            expect(typeof accountInfo.address).toBe('string');

            session.removeAccount();
            await expect(session.accountInfo).rejects.toThrow(
                'This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.'
            );

        } finally {
            if (session) await session.close();
        }
    });
});
