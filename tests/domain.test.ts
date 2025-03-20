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

        try {
            await session.registerDomain(1, 1).domainIdPromise;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }

        try {
            await session.unregisterDomain(9999999992).result;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }

        try {
            await session.holdDomain(9999993).result;
            fail("Expected an error but none was thrown.");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/This action requires an active account/);
        }
    });

    it('should register a domain, hold a domain and finally unregister a domain', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);

        const { events: registerEvents, domainIdPromise } = session.registerDomain(1, 2);
        const registerEventsFired = {
            includedInBlock: false,
            finalized: false,
            newDomain: false,
            error: false
        };

        registerEvents.on(ZkVerifyEvents.IncludedInBlock, () => {
            registerEventsFired.includedInBlock = true;
        });

        registerEvents.on(ZkVerifyEvents.Finalized, () => {
            registerEventsFired.finalized = true;
        });

        registerEvents.on(ZkVerifyEvents.NewDomain, (eventData) => {
            try {
                expect(eventData.domainId).toBeGreaterThan(0);
                registerEventsFired.newDomain = true;
            } catch (error) {
                expect(false).toBeTruthy();
            }
        });

        registerEvents.on(ZkVerifyEvents.ErrorEvent, () => {
            registerEventsFired.error = true;
        });

        const domainId = await domainIdPromise;
        expect(domainId).toBeGreaterThan(0);
        expect(typeof domainId).toBe('number');

        expect(registerEventsFired.includedInBlock).toBe(true);
        expect(registerEventsFired.finalized).toBe(true);
        expect(registerEventsFired.newDomain).toBe(true);
        expect(registerEventsFired.error).toBe(false);

        const { events: holdEvents, result: holdResult } = session.holdDomain(domainId);
        const holdEventsFired = {
            includedInBlock: false,
            finalized: false,
            domainStateChanged: false,
            error: false
        };

        holdEvents.on(ZkVerifyEvents.IncludedInBlock, () => {
            holdEventsFired.includedInBlock = true;
        });

        holdEvents.on(ZkVerifyEvents.Finalized, () => {
            holdEventsFired.finalized = true;
        });

        holdEvents.on(ZkVerifyEvents.DomainStateChanged, (eventData) => {
            try {
                expect(eventData.domainId).toBe(domainId);
                expect(eventData.domainState).toBe("Removable");
                holdEventsFired.domainStateChanged = true;
            } catch (error) {
                expect(false).toBeTruthy();
            }
        });

        holdEvents.on(ZkVerifyEvents.ErrorEvent, () => {
            holdEventsFired.error = true;
        });

        const wasSuccessful = await holdResult;
        expect(wasSuccessful).toBe(true);

        expect(holdEventsFired.includedInBlock).toBe(true);
        expect(holdEventsFired.finalized).toBe(true);
        expect(holdEventsFired.domainStateChanged).toBe(true);
        expect(holdEventsFired.error).toBe(false);

        const { events: unregisterEvents, result: unregisterResult } = session.unregisterDomain(domainId);
        const unregisterEventsFired = {
            includedInBlock: false,
            finalized: false,
            domainStateChanged: false,
            error: false
        };

        unregisterEvents.on(ZkVerifyEvents.IncludedInBlock, () => {
            unregisterEventsFired.includedInBlock = true;
        });

        unregisterEvents.on(ZkVerifyEvents.Finalized, () => {
            unregisterEventsFired.finalized = true;
        });

        unregisterEvents.on(ZkVerifyEvents.DomainStateChanged, (eventData) => {
            try {
                expect(eventData.domainId).toBe(domainId);
                expect(eventData.domainState).toBe("Removed");
                unregisterEventsFired.domainStateChanged = true;
            } catch (error) {
                expect(false).toBeTruthy();
            }
        });

        unregisterEvents.on(ZkVerifyEvents.ErrorEvent, () => {
            unregisterEventsFired.error = true;
        });

        const unregisterSuccessful = await unregisterResult;
        expect(unregisterSuccessful).toBe(true);

        expect(unregisterEventsFired.includedInBlock).toBe(true);
        expect(unregisterEventsFired.finalized).toBe(true);
        expect(unregisterEventsFired.domainStateChanged).toBe(true);
        expect(unregisterEventsFired.error).toBe(false);
    });
});
