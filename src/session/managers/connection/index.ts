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
import { AccountInfo } from '../../../types';

export class ConnectionManager {
  private connection:
    | AccountConnection
    | WalletConnection
    | EstablishedConnection;
  public customNetwork: boolean;
  public readOnly: boolean;

  constructor(
    connection: AccountConnection | WalletConnection | EstablishedConnection,
    customNetwork?: string,
  ) {
    this.connection = connection;
    this.customNetwork = !!customNetwork;
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

    return new ConnectionManager(connection, options.customWsUrl);
  }

  /**
   * Closes the current session, disconnecting from the provider and cleaning up resources.
   * @returns {Promise<void>} A promise that resolves when the session is closed.
   */
  async close(): Promise<void> {
    return closeSession(this.connection.provider);
  }

  /**
   * Retrieves account information for a specified address, index, or all accounts.
   * If no identifier is provided, it returns a list of AccountInfo objects in the order they exist.
   *
   * @param {string | number} [identifier] - The address or index of the account to fetch info for. If undefined, returns all accounts.
   * @returns {Promise<AccountInfo | AccountInfo[]>} A promise resolving to either a single account's info or an array of all accounts.
   * @throws Will throw an error if the account is not found.
   */
  async getAccountInfo(
    identifier?: string | number,
  ): Promise<AccountInfo | AccountInfo[]> {
    checkReadOnly(this.connection);

    const accountConnection = this.connection as AccountConnection;
    const accountList = Array.from(accountConnection.accounts.values());

    if (identifier === undefined) {
      return Promise.all(
        accountList.map((account) => accountInfo(this.api, account)),
      );
    }

    if (typeof identifier === 'number') {
      const account = accountList[identifier];
      if (!account) {
        throw new Error(
          `Account at index ${identifier} not found in this session.`,
        );
      }
      return accountInfo(this.api, account);
    }

    if (accountConnection.accounts.has(identifier)) {
      return accountInfo(this.api, accountConnection.accounts.get(identifier)!);
    }

    throw new Error(`Account ${identifier} not found in this session.`);
  }

  /**
   * Adds a single account to the session.
   * @param {string} seedPhrase - The seed phrase for the new account.
   * @throws Will throw an error if the account is already added.
   */
  addAccount(seedPhrase: string): void {
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
  }

  /**
   * Adds multiple accounts to the session.
   * @param {string[]} seedPhrases - An array of seed phrases for accounts to add.
   */
  addAccounts(seedPhrases: string[]): void {
    seedPhrases.forEach((seedPhrase) => this.addAccount(seedPhrase));
  }

  /**
   * Removes an account from the session.
   * @param {string | number} identifier - The address or index position of the account to remove.
   * @throws Will throw an error if the account is not found.
   */
  removeAccount(identifier: string | number): void {
    if (!('accounts' in this.connection)) {
      throw new Error('This connection type does not support accounts.');
    }

    const accountConnection = this.connection as AccountConnection;
    let accountAddress: string | undefined;

    if (typeof identifier === 'number') {
      const accountsArray = Array.from(accountConnection.accounts.keys());
      accountAddress = accountsArray[identifier];

      if (!accountAddress) {
        throw new Error(`Account at index ${identifier} not found.`);
      }
    } else {
      accountAddress = identifier;
    }

    if (!accountConnection.accounts.has(accountAddress)) {
      throw new Error(`Account ${accountAddress} not found.`);
    }

    accountConnection.accounts.delete(accountAddress);

    if (accountConnection.accounts.size === 0) {
      this.connection = {
        api: this.api,
        provider: this.provider,
      } as EstablishedConnection;
      this.readOnly = true;
    } else {
      this.readOnly = false;
    }
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
   * Retrieves the account associated with the given address or position.
   * @param {string | number} identifier - The address or index position of the account.
   * @returns {KeyringPair} The associated KeyringPair.
   * @throws {Error} If the account is not found.
   */
  getAccount(identifier: string | number): KeyringPair {
    if (!('accounts' in this.connection)) {
      throw new Error('This connection type does not support accounts.');
    }

    const accountConnection = this.connection as AccountConnection;

    if (accountConnection.accounts.size === 0) {
      throw new Error('No accounts have been added to this session.');
    }

    let account: KeyringPair | undefined;

    if (typeof identifier === 'number') {
      const accountsArray = Array.from(accountConnection.accounts.values());
      account = accountsArray[identifier];
    } else {
      account = accountConnection.accounts.get(identifier);
    }

    if (!account) {
      throw new Error(
        `Account with ${typeof identifier === 'number' ? 'index' : 'address'} '${identifier}' not found in the session.`,
      );
    }

    return account;
  }

  get connectionDetails():
    | AccountConnection
    | WalletConnection
    | EstablishedConnection {
    return this.connection;
  }
}
