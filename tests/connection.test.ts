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

            const accountInfo: AccountInfo[] = await session.getAccountInfo();
            expect(accountInfo).toBeDefined();

            expect(accountInfo[0].address).toBeDefined();
            expect(typeof accountInfo[0].address).toBe('string');

            expect(accountInfo[0].nonce).toBeDefined();
            expect(typeof accountInfo[0].nonce).toBe('number');
            expect(accountInfo[0].nonce).toBeGreaterThanOrEqual(0);

            expect(accountInfo[0].freeBalance).toBeDefined();
            expect(typeof accountInfo[0].freeBalance).toBe('string');
            expect(parseFloat(accountInfo[0].freeBalance)).toBeGreaterThanOrEqual(0);

            expect(accountInfo[0].reservedBalance).toBeDefined();
            expect(typeof accountInfo[0].reservedBalance).toBe('string');
            expect(parseFloat(accountInfo[0].reservedBalance)).toBeGreaterThanOrEqual(0);
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

            await expectSessionToBeReadOnly(session);

            await addAccountAndVerify(session, wallet);
            await removeAccountAndVerify(session);

            const address = await addAccountAndVerify(session, wallet);
            await removeAccountAndVerify(session, address);

        } finally {
            if (session) await session.close();
        }
    });

    async function expectSessionToBeReadOnly(session: zkVerifySession) {
        await expect(session.getAccountInfo()).rejects.toThrow(
            'This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.'
        );
        expect(session.readOnly).toBeTruthy();
    }

    async function addAccountAndVerify(session: zkVerifySession, wallet: string): Promise<string> {
        const address = await session.addAccount(wallet);
        const accountInfo = await session.getAccountInfo();

        expect(accountInfo).toBeDefined();
        expect(accountInfo[0].address).toBeDefined();
        expect(typeof accountInfo[0].address).toBe('string');
        expect(session.readOnly).toBeFalsy();

        return address;
    }

    async function removeAccountAndVerify(session: zkVerifySession, address?: string) {
        await session.removeAccount(address);
        await expectSessionToBeReadOnly(session);
    }
});
