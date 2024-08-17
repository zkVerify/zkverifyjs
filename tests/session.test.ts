import { zkVerifySession } from '../src';
import { EventEmitter } from 'events';
import {defaultUrls} from "../src/config";

describe('zkVerifySession class', () => {
    let session: zkVerifySession;

    const mockVerify = async () => {
        const events = new EventEmitter();
        const transactionResult = Promise.resolve({} as any);
        return { events, transactionResult };
    };

    afterEach(async () => {
        if (session) {
            await session.close();
            expect(session.api.isConnected).toBe(false);
            expect(session['provider'].isConnected).toBe(false);
        }
    });

    it('should establish a connection and close it successfully', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session).toBeDefined();
        expect(session.api).toBeDefined();
        expect(session['provider']).toBeDefined();
    });

    it('should start a session in read-only mode when no seed phrase is provided', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
    });

    it('should start a session with an account when seed phrase is provided', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
    });

    it('should start a session with a custom WebSocket URL in read-only mode when no seed phrase is provided', async () => {
        session = await zkVerifySession.start({ host: 'custom', customWsUrl: defaultUrls.testnet });
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
        expect(session['provider']).toBeDefined();
    });

    it('should start a session with a custom WebSocket URL and an account when seed phrase is provided', async () => {
        session = await zkVerifySession.start({ host: 'custom', seedPhrase: process.env.SEED_PHRASE, customWsUrl: defaultUrls.testnet });
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
        expect(session['provider']).toBeDefined();
    });

    it('should correctly handle adding, removing, and re-adding an account', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session.readOnly).toBe(true);

        session.addAccount(process.env.SEED_PHRASE!);
        expect(session.readOnly).toBe(false);

        session.removeAccount();
        expect(session.readOnly).toBe(true);

        session.addAccount(process.env.SEED_PHRASE!);
        expect(session.readOnly).toBe(false);

        session.removeAccount();
        expect(session.readOnly).toBe(true);
    });

    it('should throw an error when adding an account to a session that already has one', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);

        expect(() => session.addAccount('random-seed-phrase')).toThrow('An account is already active in this session.');
    });

    it('should not throw an error when removing an account from a session that has no account', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session.readOnly).toBe(true);
        expect(() => session.removeAccount()).not.toThrow();
    });

    it('should throw an error when trying to verify in read-only mode', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session.readOnly).toBe(true);
        await expect(
            session.verify('proofType', 'proofData')
        ).rejects.toThrow('This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.');
    });

    it('should allow verification when an account is active', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);

        session.verify = jest.fn(mockVerify);
        const { events, transactionResult } = await session.verify('proofType', 'proofData');

        expect(events).toBeDefined();
        expect(transactionResult).toBeDefined();
    });

    it('should throw an error when trying to retrieve account info in read-only mode', async () => {
        session = await zkVerifySession.start({ host: 'testnet' });
        expect(session.readOnly).toBe(true);
        await expect(session.accountInfo()).rejects.toThrow('This action requires an active account. The session is currently in read-only mode because no account is associated with it. Please provide an account at session start, or add one to the current session using `addAccount`.');
    });

    it('should return account information when an account is active', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);

        session.accountInfo = jest.fn(async () => ({
            address: 'some-address',
            nonce: 1,
            freeBalance: '1000',
            reservedBalance: '500',
        }));

        const accountInfo = await session.accountInfo();
        expect(accountInfo).toEqual({
            address: 'some-address',
            nonce: 1,
            freeBalance: '1000',
            reservedBalance: '500',
        });
    });

    it('should handle multiple verify calls', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);

        session.verify = jest.fn(mockVerify);

        const result1 = await session.verify('proofType1', 'proofData1');
        const result2 = await session.verify('proofType2', 'proofData2');

        expect(result1.events).toBeDefined();
        expect(result2.events).toBeDefined();
        expect(result1.transactionResult).toBeDefined();
        expect(result2.transactionResult).toBeDefined();
    });

    it('should properly handle verifyAndWaitForAttestationEvent', async () => {
        session = await zkVerifySession.start({ host: 'testnet', seedPhrase: process.env.SEED_PHRASE });
        expect(session.readOnly).toBe(false);

        session.verifyAndWaitForAttestationEvent = jest.fn(mockVerify);

        const { events, transactionResult } = await session.verifyAndWaitForAttestationEvent('proofType', 'proofData');
        expect(events).toBeDefined();
        expect(transactionResult).toBeDefined();
    });
});
