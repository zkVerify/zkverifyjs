import {
    CurveType,
    Library,
    ProofType,
    TransactionType,
    VerifyTransactionInfo,
    zkVerifySession,
} from '../src';
import { walletPool } from './common/walletPool';
import { loadProofAndVK, validateVerifyTransactionInfo } from './common/utils';
import { handleCommonEvents } from './common/eventHandlers';

jest.setTimeout(120000);

describe('zkVerifySession class', () => {
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

    it('should add derived accounts, then remove one derived account', async () => {
        try {
            [envVar, wallet] = await walletPool.acquireWallet();

            session = await zkVerifySession.start().Volta().withAccount(wallet);

            const accountInfoBefore = await session.getAccountInfo();
            expect(Array.isArray(accountInfoBefore)).toBe(true);
            expect(accountInfoBefore.length).toBeGreaterThanOrEqual(1);

            const baseAddress = accountInfoBefore[0].address;

            console.info('Base address:', baseAddress);
            console.info('Accounts before (count):', accountInfoBefore.length);
            console.table(
                accountInfoBefore.map((info, index) => ({
                    index,
                    address: info.address,
                    nonce: info.nonce,
                    freeBalance: info.freeBalance,
                    reservedBalance: info.reservedBalance,
                })),
            );

            const numberOfChildrenToAdd = 5;

            const addedAddresses: string[] =
                typeof (session as any).addDerivedAccounts === 'function'
                    ? await (session as any).addDerivedAccounts(baseAddress, numberOfChildrenToAdd)
                    : await (session as any).connectionManager.addDerivedAccounts(baseAddress, numberOfChildrenToAdd);

            console.info('Added derived addresses (count):', addedAddresses.length);
            console.table(addedAddresses.map((address, index) => ({ index, address })));

            const accountInfoAfterAdd = await session.getAccountInfo();
            console.info('Accounts after add (count):', accountInfoAfterAdd.length);
            console.table(
                accountInfoAfterAdd.map((info, index) => ({
                    index,
                    address: info.address,
                    nonce: info.nonce,
                    freeBalance: info.freeBalance,
                    reservedBalance: info.reservedBalance,
                })),
            );

            expect(addedAddresses).toHaveLength(numberOfChildrenToAdd);
            expect(new Set(addedAddresses).size).toBe(numberOfChildrenToAdd);
            const addressesAfterAddSet = new Set(accountInfoAfterAdd.map((info) => info.address));
            for (const derivedAddress of addedAddresses) {
                expect(derivedAddress).not.toEqual(baseAddress);
                expect(addressesAfterAddSet.has(derivedAddress)).toBe(true);
            }
            expect(accountInfoAfterAdd.length).toBe(accountInfoBefore.length + numberOfChildrenToAdd);

            const addressToRemove = addedAddresses[0];
            console.info('Removing derived address:', addressToRemove);

            if (typeof (session as any).removeAccount === 'function') {
                await (session as any).removeAccount(addressToRemove);
            } else {
                await (session as any).connectionManager.removeAccount(addressToRemove);
            }

            const accountInfoAfterRemove = await session.getAccountInfo();
            console.info('Accounts after remove (count):', accountInfoAfterRemove.length);
            console.table(
                accountInfoAfterRemove.map((info, index) => ({
                    index,
                    address: info.address,
                    nonce: info.nonce,
                    freeBalance: info.freeBalance,
                    reservedBalance: info.reservedBalance,
                })),
            );

            const addressesAfterRemoveSet = new Set(accountInfoAfterRemove.map((info) => info.address));
            expect(addressesAfterRemoveSet.has(addressToRemove)).toBe(false);
            expect(addressesAfterRemoveSet.has(baseAddress)).toBe(true);
            for (const remainingDerived of addedAddresses.slice(1)) {
                expect(addressesAfterRemoveSet.has(remainingDerived)).toBe(true);
            }
            expect(accountInfoAfterRemove.length).toBe(accountInfoAfterAdd.length - 1);

            await expect(
                (async () => {
                    const arr = await session.getAccountInfo(addressToRemove);
                    if (!arr || arr.length === 0) throw new Error('Account not found');
                })(),
            ).rejects.toThrow();
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Test failed with error: ${error.message}\nStack: ${error.stack}`);
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                throw new Error(`Test failed with error object: ${(error as any).message}`);
            } else {
                throw new Error(`Test failed with unknown error: ${JSON.stringify(error)}`);
            }
        }
    });
});
