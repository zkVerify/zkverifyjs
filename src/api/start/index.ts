import { establishConnection } from '../connection';
import { setupAccount } from '../account';
import { zkVerifySessionOptions } from '../../session/types';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../connection/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { SupportedNetwork } from '../../config';

export async function startSession(
  options: zkVerifySessionOptions,
): Promise<AccountConnection | EstablishedConnection> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'startSession should not be called in a browser environment, use "startWalletSession"',
    );
  }

  const { networkConfig, seedPhrases } = options;
  const { api, provider } = await establishConnection(networkConfig);
  const isMainnetNetwork = networkConfig.network !== SupportedNetwork.Volta;
  if (seedPhrases && seedPhrases.length > 0) {
    const uniqueAccounts = new Map<string, KeyringPair>();

    for (const phrase of seedPhrases) {
      const account = setupAccount(phrase, isMainnetNetwork);
      if (uniqueAccounts.has(account.address)) {
        console.warn(
          `Skipping adding account ${account.address} to session as it is already active.`,
        );
        continue;
      }
      uniqueAccounts.set(account.address, account);
    }

    return { api, provider, accounts: uniqueAccounts } as AccountConnection;
  } else {
    return { api, provider } as EstablishedConnection;
  }
}

export async function startWalletSession(
  options: zkVerifySessionOptions,
): Promise<WalletConnection> {
  if (typeof window === 'undefined') {
    throw new Error(
      'This function must be called in a browser environment, for server side / backend use "startSession"',
    );
  }
  const { networkConfig, wallet } = options;
  const { api, provider } = await establishConnection(networkConfig);

  if (!wallet || !wallet.source || !wallet.accountAddress) {
    throw new Error('Wallet source and accountAddress must be provided.');
  }

  const { web3Enable, web3Accounts, web3FromSource } = await import(
    '@polkadot/extension-dapp'
  );

  const extensions = await web3Enable('zkVerify');
  if (extensions.length === 0) {
    throw new Error('No extension installed or access was denied.');
  }

  const accounts = await web3Accounts();
  if (accounts.length === 0) {
    throw new Error('No accounts found.');
  }

  const selectedAccount = accounts.find(
    (account) =>
      account.meta.source === wallet.source &&
      account.address === wallet.accountAddress,
  );

  if (!selectedAccount) {
    throw new Error(
      `No account found for wallet source: ${wallet.source} and address: ${wallet.accountAddress}`,
    );
  }

  const injector = await web3FromSource(selectedAccount.meta.source);

  return {
    api,
    provider,
    injector,
    accountAddress: selectedAccount.address,
  };
}
