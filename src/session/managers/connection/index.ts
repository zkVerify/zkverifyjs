import { startSession, startWalletSession } from '../../../api/start';
import { closeSession } from '../../../api/close';
import { zkVerifySessionOptions } from '../../types';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../../../api/connection/types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { accountInfo } from '../../../api/accountInfo';
import { setupAccount } from '../../../api/account';
import { checkReadOnly } from '../../../utils/helpers';
import { AccountInfo, NetworkConfig } from '../../../types';
import { Mutex } from 'async-mutex';
import { SupportedNetwork } from '../../../config';

export class ConnectionManager {
  private accountMutex = new Mutex();
  private connection:
    | AccountConnection
    | WalletConnection
    | EstablishedConnection;
  public customNetwork: boolean;
  public readOnly: boolean;

  constructor(
    connection: AccountConnection | WalletConnection | EstablishedConnection,
    config: NetworkConfig,
  ) {
    this.connection = connection;
    this.customNetwork = config.host === SupportedNetwork.Custom;
    this.readOnly =
      !('accounts' in connection) &&
      !('injector' in connection) &&
      !('signer' in connection);
  }

  /**
   * Creates a new session with a connection to the specified network.
   * Supports multiple accounts for startSession if provided in options.
   * @param {zkVerifySessionOptions} options - The session configuration options.
   * @returns {Promise<ConnectionManager>} A promise resolving to a ConnectionManager instance.
   */
  static async createSession(
    options: zkVerifySessionOptions,
  ): Promise<ConnectionManager> {
    const connection = options.wallet
      ? await startWalletSession(options)
      : await startSession(options);

    return new ConnectionManager(connection, options.networkConfig);
  }

  /**
   * Closes the current session, disconnecting from the provider and cleaning up resources.
   * @returns {Promise<void>} A promise that resolves when the session is closed.
   */
  async close(): Promise<void> {
    return closeSession(this.connection.provider);
  }

  /**
   * Retrieves account information for a specified address or all accounts.
   * If no address is provided, returns an array of all account info objects.
   *
   * @param {string} [accountAddress] - The address of the account to fetch info for. If undefined, returns all accounts.
   * @returns {Promise<AccountInfo[]>} A promise resolving to an array of account info objects.
   * @throws Will throw an error if the account is not found.
   */
  async getAccountInfo(accountAddress?: string): Promise<AccountInfo[]> {
    checkReadOnly(this.connection);

    const accountConnection = this.connection as AccountConnection;
    const accountList = Array.from(accountConnection.accounts.values());

    if (accountAddress === undefined) {
      return Promise.all(
        accountList.map((account) => accountInfo(this.api, account)),
      );
    }

    if (accountConnection.accounts.has(accountAddress)) {
      return [
        await accountInfo(
          this.api,
          accountConnection.accounts.get(accountAddress)!,
        ),
      ];
    }

    throw new Error(`Account ${accountAddress} not found in this session.`);
  }

  /**
   * Adds a single account to the session in a thread-safe manner.
   *
   * @param {string} seedPhrase - The seed phrase used to generate the account.
   * @returns {Promise<string>} A promise resolving to the account address.
   * @throws {Error} If the account is already added.
   */
  async addAccount(seedPhrase: string): Promise<string> {
    return this.accountMutex.runExclusive(async () => {
      const account = setupAccount(seedPhrase);

      if (!('accounts' in this.connection)) {
        this.connection = {
          api: this.api,
          provider: this.provider,
          accounts: new Map(),
        } as AccountConnection;
      }

      const accountConnection = this.connection as AccountConnection;

      if (accountConnection.accounts.has(account.address)) {
        throw new Error(`Account ${account.address} is already active.`);
      }

      accountConnection.accounts.set(account.address, account);
      this.readOnly = false;

      return account.address;
    });
  }

  /**
   * Adds multiple accounts to the session in a thread-safe manner.
   *
   * @param {string[]} seedPhrases - An array of seed phrases to generate accounts.
   * @returns {Promise<string[]>} A promise resolving to an array of added account addresses.
   * @throws {Error} If any of the accounts are already active.
   */
  async addAccounts(seedPhrases: string[]): Promise<string[]> {
    return Promise.all(
      seedPhrases.map((seedPhrase) => this.addAccount(seedPhrase)),
    );
  }

  /**
   * Removes an account from the session in a thread-safe manner.
   *
   * @param {string} [address] - (Optional) The account address to remove.
   *                              If omitted and only one account exists, that account will be removed.
   *                              If omitted and no accounts exist, the method does nothing.
   * @throws {Error} If a specified account is not found or the connection type does not support accounts.
   */
  async removeAccount(address?: string): Promise<void> {
    await this.accountMutex.runExclusive(async () => {
      if (!('accounts' in this.connection)) {
        throw new Error('This connection type does not support accounts.');
      }

      const accountConnection = this.connection as AccountConnection;

      if (!address && accountConnection.accounts.size === 1) {
        const firstAccount =
          [...accountConnection.accounts.keys()][0] ?? undefined;
        if (firstAccount) {
          address = firstAccount;
        }
      }

      if (!address) {
        return;
      }

      if (!accountConnection.accounts.has(address)) {
        throw new Error(`Account ${address} not found.`);
      }

      accountConnection.accounts.delete(address);

      if (accountConnection.accounts.size === 0) {
        this.connection = {
          api: this.api,
          provider: this.provider,
        } as EstablishedConnection;
        this.readOnly = true;
      }
    });
  }

  /**
   * Getter for the API instance.
   * @returns {ApiPromise} The Polkadot.js API instance.
   */
  get api(): ApiPromise {
    return this.connection.api;
  }

  /**
   * Getter for the provider.
   * @returns {WsProvider} The WebSocket provider.
   */
  get provider(): WsProvider {
    return this.connection.provider;
  }

  /**
   * Retrieves the account associated with the given address.
   * If no address is provided, it returns the first available account.
   *
   * @param {string} [accountAddress] - The address of the account to retrieve. If not provided, the first account is returned.
   * @returns {KeyringPair} The associated KeyringPair.
   * @throws {Error} If no accounts exist in the session or the specified account is not found.
   */
  getAccount(accountAddress?: string): KeyringPair {
    if (!('accounts' in this.connection)) {
      throw new Error('This connection type does not support accounts.');
    }

    const accountConnection = this.connection as AccountConnection;

    if (accountConnection.accounts.size === 0) {
      throw new Error('No accounts have been added to this session.');
    }

    if (!accountAddress) {
      return Array.from(accountConnection.accounts.values())[0];
    }

    const account = accountConnection.accounts.get(accountAddress);

    if (!account) {
      throw new Error(
        `Account with address '${accountAddress}' not found in the session.`,
      );
    }

    return account;
  }

  /**
   * Retrieves the current connection details.
   *
   * @returns {AccountConnection | WalletConnection | EstablishedConnection} The current connection instance.
   */
  get connectionDetails():
    | AccountConnection
    | WalletConnection
    | EstablishedConnection {
    return this.connection;
  }
}
