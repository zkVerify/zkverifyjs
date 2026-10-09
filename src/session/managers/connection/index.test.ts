import { describe, it, expect, beforeAll } from '@jest/globals';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/api';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { ConnectionManager, MAX_DERIVED_ACCOUNTS_PER_CALL } from './index.js';
import { AccountConnection } from '../../../api/connection/types.js';
import { NetworkConfig } from '../../../types.js';
import { SupportedNetwork } from '../../../config/index.js';

const config: NetworkConfig = {
  host: SupportedNetwork.Custom,
  websocket: 'ws://127.0.0.1:9944',
  rpc: 'http://127.0.0.1:9944',
};

const accountCount = (manager: ConnectionManager): number =>
  (manager.connectionDetails as AccountConnection).accounts.size;

const makeManager = (pairs: KeyringPair[]): ConnectionManager => {
  const connection: AccountConnection = {
    api: {} as ApiPromise,
    provider: {} as WsProvider,
    accounts: new Map(pairs.map((pair) => [pair.address, pair])),
    runtimeSpec: { specVersion: 1, specName: 'zkv' },
  };
  return new ConnectionManager(connection, config);
};

describe('ConnectionManager key hygiene', () => {
  let keyring: Keyring;

  beforeAll(async () => {
    await cryptoWaitReady();
    keyring = new Keyring({ type: 'sr25519' });
  });

  it('locks the keypair when an account is removed', async () => {
    const pair = keyring.addFromUri('//Alice');
    const manager = makeManager([pair]);
    expect(pair.isLocked).toBe(false);

    await manager.removeAccount(pair.address);

    expect(pair.isLocked).toBe(true);
    expect(manager.readOnly).toBe(true);
    expect(() => pair.sign(new Uint8Array([1]))).toThrow();
  });

  it('leaves other accounts usable after one is removed', async () => {
    const alice = keyring.addFromUri('//Alice');
    const bob = keyring.addFromUri('//Bob');
    const manager = makeManager([alice, bob]);

    await manager.removeAccount(alice.address);

    expect(bob.isLocked).toBe(false);
    expect(manager.getAccount(bob.address)).toBe(bob);
    expect(manager.readOnly).toBe(false);
  });

  it('rejects an addDerivedAccounts count above the per-call limit', async () => {
    const base = keyring.addFromUri('//Alice');
    const manager = makeManager([base]);

    await expect(
      manager.addDerivedAccounts(
        base.address,
        MAX_DERIVED_ACCOUNTS_PER_CALL + 1,
      ),
    ).rejects.toThrow(
      `count must not exceed ${MAX_DERIVED_ACCOUNTS_PER_CALL} per call.`,
    );
    expect(accountCount(manager)).toBe(1);
  });

  it('still derives up to the limit', async () => {
    const base = keyring.addFromUri('//Alice');
    const manager = makeManager([base]);

    const added = await manager.addDerivedAccounts(base.address, 3);

    expect(added).toHaveLength(3);
    expect(new Set(added).size).toBe(3);
    expect(accountCount(manager)).toBe(4);
  });
});
