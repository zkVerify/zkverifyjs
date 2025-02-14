import { cryptoWaitReady } from '@polkadot/util-crypto';
import { setupAccount } from './index';
import { walletPool } from '../../../tests/common/walletPool';

describe('setupAccount', () => {
  beforeAll(async () => {
    await cryptoWaitReady();
  });

  it('should return a KeyringPair when provided with a valid seed phrase', async () => {
    let wallet: string | undefined;
    let envVar: string | undefined;
    try {
      [envVar, wallet] = await walletPool.acquireWallet();
      const account = setupAccount(wallet);

      expect(account).toBeDefined();
      expect(account.publicKey).toBeDefined();
    } finally {
      if (envVar) {
        await walletPool.releaseWallet(envVar);
      }
    }
  });

  it('should throw an error with a custom message when an invalid seed phrase is provided', () => {
    const invalidSeedPhrase = 'invalid-seed-phrase';

    expect(() => setupAccount(invalidSeedPhrase)).toThrowError(
      /Invalid seed phrase provided:/,
    );
  });
});
