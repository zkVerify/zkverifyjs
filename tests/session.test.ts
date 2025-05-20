import { CurveType, Library, SupportedNetwork, zkVerifySession } from '../src';
import { EventEmitter } from 'events';
import { walletPool } from './common/walletPool';
import { loadProofAndVK } from "./common/utils";
import { ProofType } from "../src";
import { SupportedNetworkConfig } from "../src/config"
import { ProofMethodMap } from "../src/session/types";


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
        session = await zkVerifySession.start().Volta().readOnly();
        expect(session).toBeDefined();
        expect(session.api).toBeDefined();
        expect(session['provider']).toBeDefined();
    });

    it('should start a session in read-only mode when no seed phrase is provided', async () => {
        session = await zkVerifySession.start().Volta().readOnly();
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
    });

    it('should start a session with an account when seed phrase is provided', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
    });

    it('should start a session with a custom WebSocket URL in read-only mode when no seed phrase is provided', async () => {
        const { host: _omit, ...customConfig } = SupportedNetworkConfig[SupportedNetwork.Volta];

        session = await zkVerifySession.start().Custom(customConfig).readOnly();
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(true);
        expect(session.api).toBeDefined();
        expect(session['provider'].isConnected).toBe(true);
    });

    it('should start a session with a custom WebSocket URL and an account when seed phrase is provided', async () => {
        const { host: _omit, ...customConfig } = SupportedNetworkConfig[SupportedNetwork.Volta];
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Custom(customConfig).withAccount(wallet);
        expect(session).toBeDefined();
        expect(session.readOnly).toBe(false);
        expect(session.api).toBeDefined();
        expect(session['provider'].isConnected).toBe(true);
    });

    it('should correctly handle adding, removing, and re-adding an account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().readOnly();
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
        session = await zkVerifySession.start().Volta().withAccount(wallet);

        expect(session.readOnly).toBe(false);
        await expect(session.addAccount(wallet!))
            .rejects.toThrow(/^Account \w+ is already active\.$/);
    });

    it('should throw an error when trying to remove a non-existent account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const nonExistentAddress = '5FakeAddressDoesNotExist12345';

        await expect(session.removeAccount(nonExistentAddress))
            .rejects.toThrow(`Account ${nonExistentAddress} not found.`);
    });

    it('should allow verification when an account is active', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);
        expect(session.readOnly).toBe(false);

        const mockBuilder = {
            ultraplonk: jest.fn(() => ({
                execute: mockVerifyExecution
            })),
        } as unknown as ProofMethodMap;

        session.verify = jest.fn(() => mockBuilder);

        const { events, transactionResult } = await session
            .verify()
            .ultraplonk({
                numberOfPublicInputs: 1
            })
            .execute({
            proofData: {
                proof: 'proofData',
                vk: 'vk'
            }
        });

        expect(events).toBeDefined();
        expect(transactionResult).toBeDefined();
    });

    it('should return account information when an account is active', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        session = await zkVerifySession.start().Volta().withAccount(wallet);
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
            session = await zkVerifySession.start().Volta().withAccount(wallet);
            expect(session.readOnly).toBe(false);

            const mockBuilder = {
                ultraplonk: jest.fn(() => ({ execute: mockVerifyExecution })),
                groth16: jest.fn(() => ({ execute: mockVerifyExecution })),
            } as unknown as ProofMethodMap;

            session.verify = jest.fn(() => mockBuilder);

            const [result1, result2] = await Promise.all([
                session
                    .verify()
                    .ultraplonk({
                        numberOfPublicInputs: 1
                    })
                    .execute(
                        {
                            proofData: {
                    proof: 'proofData',
                    vk: 'vk'
                    }
                }),
                session
                    .verify()
                    .groth16(
                        {
                            library: Library.snarkjs,
                            curve: CurveType.bls12381
                        })
                    .execute(
                        { proofData:
                                {
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

        session = await zkVerifySession.start().Volta().withAccounts([wallet, wallet])

        let accountsInfo = await session.getAccountInfo();
        expect(accountsInfo.length).toBe(1);
    });

    it('should allow multiple unique accounts to be added using withAccounts, remove one, and verify the remaining account', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
        [envVar2, wallet2] = await walletPool.acquireWallet();

        session = await zkVerifySession.start().Volta().withAccounts([wallet, wallet2]);

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

    it('should handle setting nonces for multiple concurrent same-session calls', async () => {
        try {
            [envVar, wallet] = await walletPool.acquireWallet();
            const proofData = loadProofAndVK({ proofType: ProofType.ultraplonk, config: {
                numberOfPublicInputs: 1
                } });

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const accountInfo = await session.getAccountInfo();
            const startingNonce = accountInfo[0].nonce;

            const [tx1, tx2] = await Promise.all([
                (async () => {
                    const { events, transactionResult } = await session
                        .verify()
                        .ultraplonk({
                            numberOfPublicInputs: 1
                        })
                        .nonce(startingNonce).execute({
                        proofData: {
                            proof: proofData.proof.proof,
                            vk: proofData.vk
                        }
                    });
                    await transactionResult;
                    return { events, transactionResult };
                })(),
                (async () => {
                    const { events, transactionResult } = await session
                        .verify()
                        .ultraplonk(
                            {
                                numberOfPublicInputs: 1
                            })
                        .nonce(startingNonce + 1)
                        .execute(
                            {
                        proofData: {
                            proof: proofData.proof.proof,
                            vk: proofData.vk
                        }
                    });
                    await transactionResult;
                    return { events, transactionResult };
                })()
            ]);

            expect(tx1).toBeDefined();
            expect(tx2).toBeDefined();
            expect(tx1.transactionResult).toBeDefined();
            expect(tx2.transactionResult).toBeDefined();

        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}`);
            } else {
                throw new Error('Test failed with an unknown error');
            }
        }
    });
});
