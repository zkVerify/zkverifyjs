import { zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import { ZkVerifyEvents } from "../src";

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

        const { events: registerEvents, domainId } = await session.registerDomain(1, 2);

        registerEvents.on(ZkVerifyEvents.IncludedInBlock, (eventData) => {
            console.log("Transaction included in block:", eventData);
        });

        registerEvents.on(ZkVerifyEvents.Finalized, (eventData) => {
            console.log("Transaction finalized:", eventData);
        });

        registerEvents.on(ZkVerifyEvents.NewDomain, (eventData) => {
            console.log("New domain registered:", eventData.domainId);
        });

        registerEvents.on(ZkVerifyEvents.ErrorEvent, (error) => {
            console.error("Transaction error:", error);
        });

        console.log("Domain registered with ID:", domainId);

        const { events: unRegisterEvents } = await session.unregisterDomain(domainId);

        unRegisterEvents.on(ZkVerifyEvents.IncludedInBlock, (eventData) => {
            console.log("Transaction included in block:", eventData);
        });

        unRegisterEvents.on(ZkVerifyEvents.Finalized, (eventData) => {
            console.log("Transaction finalized:", eventData);
        });

        unRegisterEvents.on(ZkVerifyEvents.DomainStateChanged, (eventData) => {
            console.log("Domain State Changed", eventData.domainState);
        });

        unRegisterEvents.on(ZkVerifyEvents.ErrorEvent, (error) => {
            console.error("Transaction error:", error);
        });

    });
});
