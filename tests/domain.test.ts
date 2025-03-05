import { zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';

jest.setTimeout(120000);
describe('Domain interaction tests', () => {
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

    it('should error when attempting to register, unregister or hold a domain in a readOnly session', async () => {
        session = await zkVerifySession.start().Testnet().readOnly();

        await expect(session.registerDomain(1, 1))
            .rejects.toThrow(expect.objectContaining({ message: expect.stringContaining("This action requires an active account.") }));

        await expect(session.unregisterDomain(9999999992))
            .rejects.toThrow(expect.objectContaining({ message: expect.stringContaining("This action requires an active account.") }));

        await expect(session.holdDomain(9999993))
            .rejects.toThrow(expect.objectContaining({ message: expect.stringContaining("This action requires an active account.") }));
    });

    it('should register a domain, hold a domain and finally unregister a domain', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);

        const result = await session.registerDomain(1, 2);
    });
});
