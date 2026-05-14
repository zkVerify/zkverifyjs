import { cryptoWaitReady } from '@polkadot/util-crypto';
import { setupAccount } from './index.js';
import { walletPool } from '../../../tests/common/walletPool.js';

jest.setTimeout(300000);

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
      /Invalid seed phrase: expected a BIP39 mnemonic of 12, 15, 18, 21, or 24 words/,
    );
  });

  it('rejects an empty seed phrase', () => {
    expect(() => setupAccount('')).toThrowError(/must not be empty/);
    expect(() => setupAccount('   ')).toThrowError(/must not be empty/);
  });

  it('rejects substrate dev SURIs (//Alice) on Volta', () => {
    expect(() => setupAccount('//Alice', false, false)).toThrowError(
      /Dev account SURI .* is not valid on Volta or zkVerify mainnet/,
    );
  });

  it('rejects substrate dev SURIs on zkVerify mainnet', () => {
    expect(() => setupAccount('//Bob', true, false)).toThrowError(
      /not valid on Volta or zkVerify mainnet/,
    );
  });

  it('accepts substrate dev SURIs on Custom networks', () => {
    const account = setupAccount('//Alice', false, true);
    expect(account).toBeDefined();
    expect(account.publicKey).toBeDefined();
  });

  it('rejects mnemonics with the wrong word count', () => {
    const ten = 'one two three four five six seven eight nine ten';
    expect(() => setupAccount(ten)).toThrowError(
      /expected a BIP39 mnemonic.* got 10/,
    );
  });

  it('accepts a 32-byte hex seed', () => {
    const hexSeed = '0x' + 'a'.repeat(64);
    const account = setupAccount(hexSeed);
    expect(account).toBeDefined();
    expect(account.publicKey).toBeDefined();
  });

  it('accepts mnemonic with derivation path on a public network', () => {
    const mnemonic =
      'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
    const account = setupAccount(`${mnemonic}//derived`, false, false);
    expect(account).toBeDefined();
  });
});
