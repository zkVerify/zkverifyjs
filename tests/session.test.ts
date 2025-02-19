import { CurveType, Library, zkVerifySession } from '../src';
import { EventEmitter } from 'events';
import { ProofMethodMap } from "../src/session/builders/verify";
import { walletPool } from './common/walletPool';

jest.setTimeout(120000);
describe('zkVerifySession class', () => {
    let session: zkVerifySession;
    let wallet: string | null = null;
    let envVar: string | null = null;
    let wallet2: string | null = null;
    let envVar2: string | null = null;

    const mockVerifyExecution = jest.fn(async () => {
        const events = new EventEmitter();
        const transactionResult = Promise.resolve({} as any);
        return { events, transactionResult };
    });

    beforeEach(async () => {
        wallet = null;
        envVar = null;
        wallet2 = null;
        envVar2 = null;
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
        if (envVar2) {
            await walletPool.releaseWallet(envVar2);
        }
        jest.clearAllMocks();
    });

    it('should establish a connection and close it successfully', async () => {
        session = await zkVerifySession.start().Testnet().readOnly();
        expect(session).toBeDefined();
        expect(session.api).toBeDefined();
        expect(session['provider']).toBeDefined();
    });

    it('should start a session in read-only mode when no seed phrase is provided', async () => {
        session = await zkVerifySession.start().Testnet().readOnly();
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
    });

    it('should start a session with an account when seed phrase is provided', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
    });

    it('should start a session with a custom WebSocket URL in read-only mode when no seed phrase is provided', async () => {
        session = await zkVerifySession.start().Custom("wss://testnet-rpc.zkverify.io").readOnly();
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
        expect(session['provider'].isConnected).toBe(true);
    });

    it('should start a session with a custom WebSocket URL and an account when seed phrase is provided', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Custom("wss://testnet-rpc.zkverify.io").withAccount(wallet);
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
        expect(session['provider'].isConnected).toBe(true);
    });

    it('should correctly handle adding, removing, and re-adding an account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().readOnly();
        expect(session.readOnly).toBe(true);

        await session.addAccount(wallet);
        expect(session.readOnly).toBe(false);

        await session.removeAccount();
        expect(session.readOnly).toBe(true);

        const address = await session.addAccount(wallet);
        expect(session.readOnly).toBe(false);

        await session.removeAccount(address);
        expect(session.readOnly).toBe(true);
    });

    it('should throw an error when adding an account to a session that already has been added', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);

        expect(session.readOnly).toBe(false);
        await expect(session.addAccount(wallet!))
            .rejects.toThrow(/^Account \w+ is already active\.$/);
    });

    it('should throw an error when trying to remove a non-existent account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);

        const nonExistentAddress = '5FakeAddressDoesNotExist12345';

        await expect(session.removeAccount(nonExistentAddress))
            .rejects.toThrow(`Account ${nonExistentAddress} not found.`);
    });

    it('should allow verification when an account is active', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);
        expect(session.readOnly).toBe(false);

        const mockBuilder = {
            fflonk: jest.fn(() => ({
                execute: mockVerifyExecution
            })),
        } as unknown as ProofMethodMap;

        session.verify = jest.fn(() => mockBuilder);

        const { events, transactionResult } = await session.verify().fflonk().execute({
            proofData: {
                proof: 'proofData',
                publicSignals: 'publicSignals',
                vk: 'vk'
            }
        });

        expect(events).toBeDefined();
        expect(transactionResult).toBeDefined();
    });

    it('should return account information when an account is active', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);
        expect(session.readOnly).toBe(false);

        const accountInfo = await session.getAccountInfo();
        expect(accountInfo).toMatchObject([{
            address: expect.any(String),
            nonce: expect.any(Number),
            freeBalance: expect.any(String),
            reservedBalance: expect.any(String),
        }]);
    });

    it('should handle multiple verify calls concurrently', async () => {
            [envVar, wallet] = await walletPool.acquireWallet();
            session = await zkVerifySession.start().Testnet().withAccount(wallet);
            expect(session.readOnly).toBe(false);

            const mockBuilder = {
                fflonk: jest.fn(() => ({ execute: mockVerifyExecution })),
                groth16: jest.fn(() => ({ execute: mockVerifyExecution })),
            } as unknown as ProofMethodMap;

            session.verify = jest.fn(() => mockBuilder);

            const [result1, result2] = await Promise.all([
                session.verify().fflonk().execute({ proofData: {
                    proof: 'proofData',
                    publicSignals: 'publicSignals',
                    vk: 'vk'
                    }
                }),
                session.verify().groth16(Library.snarkjs, CurveType.bls12381).execute({ proofData: {
                        proof: 'proofData',
                        publicSignals: 'publicSignals',
                        vk: 'vk'
                    }
                })
            ]);

            expect(result1.events).toBeDefined();
            expect(result2.events).toBeDefined();
            expect(result1.transactionResult).toBeDefined();
            expect(result2.transactionResult).toBeDefined();
        });

    it('withAccounts should add only one account when attempting to add the same account twice', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();

        session = await zkVerifySession.start().Testnet().withAccounts([wallet, wallet])

        let accountsInfo = await session.getAccountInfo();
        expect(accountsInfo.length).toBe(1);
    });

    it('should allow multiple unique accounts to be added using withAccounts, remove one, and verify the remaining account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        [envVar2, wallet2] = await walletPool.acquireWallet();

        session = await zkVerifySession.start().Testnet().withAccounts([wallet, wallet2]);

        let accountsInfo = await session.getAccountInfo();

        expect(Array.isArray(accountsInfo)).toBe(true);
        expect(accountsInfo.length).toBe(2);

        const firstAccountAddress = accountsInfo[0].address;
        const secondAccountAddress = accountsInfo[1].address;

        expect(firstAccountAddress).not.toEqual(secondAccountAddress);

        await session.removeAccount(firstAccountAddress);
        expect(session.readOnly).toBe(false);

        const remainingAccountsInfo = await session.getAccountInfo(secondAccountAddress);
        expect(remainingAccountsInfo.length).toBe(1);
        expect(remainingAccountsInfo[0].address).toEqual(secondAccountAddress);

        await session.removeAccount(secondAccountAddress);
        expect(session.readOnly).toBe(true);
    });
});
