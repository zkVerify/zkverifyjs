import { CurveType, Library, zkVerifySession } from '../src';
import { EventEmitter } from 'events';
import { ProofMethodMap } from "../src/session/builders/verify";
import { walletPool } from './common/walletPool';

describe('zkVerifySession class', () => {
    let session: zkVerifySession;
    let wallet: string | null = null;
    let envVar: string | null = null;

    const mockVerifyExecution = jest.fn(async () => {
        const events = new EventEmitter();
        const transactionResult = Promise.resolve({} as any);
        return { events, transactionResult };
    });

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

        session.addAccount(wallet);
        expect(session.readOnly).toBe(false);

        session.removeAccount();
        expect(session.readOnly).toBe(true);

        session.addAccount(wallet);
        expect(session.readOnly).toBe(false);

        session.removeAccount();
        expect(session.readOnly).toBe(true);
    });

    it('should throw an error when adding an account to a session that already has one', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Testnet().withAccount(wallet);
        expect(session.readOnly).toBe(false);

        expect(() => session.addAccount('random-seed-phrase')).toThrow('An account is already active in this session.');
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


        const accountInfo = await session.accountInfo;
        expect(accountInfo).toMatchObject({
            address: expect.any(String),
            nonce: expect.any(Number),
            freeBalance: expect.any(String),
            reservedBalance: expect.any(String),
        });
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
});
