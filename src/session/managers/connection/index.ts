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
      !('account' in connection) &&
      !('injector' in connection) &&
      !('signer' in connection);
  }

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
   * Retrieves account information for the active account in the session.
   * @returns {Promise<AccountInfo>} A promise that resolves to the account information.
   * @throws Will throw an error if the session is in read-only mode.
   */
  async getAccountInfo(): Promise<AccountInfo> {
    checkReadOnly(this.connection);

    if ('account' in this.connection) {
      return accountInfo(this.api, this.connection.account);
    }

    throw new Error('No account available in this session.');
  }

  /**
   * Allows the user to add an account to the session if one is not already active.
   * @param {string} seedPhrase - The seed phrase for the account to add.
   * @returns {void}
   * @throws Will throw an error if an account is already active in the session.
   */
  addAccount(seedPhrase: string): void {
    if ('account' in this.connection) {
      throw new Error('An account is already active in this session.');
    }

    this.connection = {
      api: this.api,
      provider: this.provider,
      account: setupAccount(seedPhrase),
    };
    this.readOnly = false;
  }

  /**
   * Allows the user to remove the active account from the session, making it read-only.
   * If no account is active, the method simply ensures the session is in read-only mode.
   * @returns {void}
   */
  removeAccount(): void {
    if ('account' in this.connection) {
      this.connection = {
        api: this.api,
        provider: this.provider,
      };
      this.readOnly = true;
    } else {
      throw new Error('No account to remove.');
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
   * Getter for the account, if available.
   * @returns {KeyringPair | undefined} The active account, or undefined if in read-only mode.
   */
  get account(): KeyringPair | undefined {
    return 'account' in this.connection ? this.connection.account : undefined;
  }

  get connectionDetails():
    | AccountConnection
    | WalletConnection
    | EstablishedConnection {
    return this.connection;
  }
}
