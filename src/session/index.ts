import { ConnectionManager } from './managers/connection';
import { VerificationManager } from './managers/verification';
import { VerificationKeyRegistrationManager } from './managers/register';
import { EventManager } from './managers/events';
import { ExtrinsicManager } from './managers/extrinsic';
import { zkVerifySessionOptions } from './types';
import { SupportedNetwork } from '../config';
import { NetworkBuilder, SupportedNetworkMap } from './builders/network';
import { PoEManager } from './managers/poe';
import { FormatManager } from './managers/format';
import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  AccountConnection,
  WalletConnection,
  EstablishedConnection,
} from '../api/connection/types';
import { bindMethods } from '../utils/helpers';
import { AccountInfo } from '../types';

export class zkVerifySession {
  private readonly connectionManager: ConnectionManager;

  declare verify: VerificationManager['verify'];
  declare optimisticVerify: VerificationManager['optimisticVerify'];
  declare registerVerificationKey: VerificationKeyRegistrationManager['registerVerificationKey'];
  declare format: FormatManager['format'];
  declare poe: PoEManager['poe'];
  declare subscribeToNewAttestations: EventManager['subscribe'];
  declare unsubscribe: EventManager['unsubscribe'];
  declare estimateCost: ExtrinsicManager['estimateCost'];
  declare createSubmitProofExtrinsic: ExtrinsicManager['createSubmitProofExtrinsic'];
  declare createExtrinsicHex: ExtrinsicManager['createExtrinsicHex'];
  declare createExtrinsicFromHex: ExtrinsicManager['createExtrinsicFromHex'];
  declare close: ConnectionManager['close'];
  declare addAccount: ConnectionManager['addAccount'];
  declare addAccounts: ConnectionManager['addAccounts'];
  declare removeAccount: ConnectionManager['removeAccount'];
  declare getAccount: ConnectionManager['getAccount'];
  declare getAccountInfo: ConnectionManager['getAccountInfo'];

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;

    const managers = [
      new VerificationManager(connectionManager),
      new VerificationKeyRegistrationManager(connectionManager),
      new EventManager(connectionManager),
      new ExtrinsicManager(connectionManager),
      new PoEManager(connectionManager),
      new FormatManager(),
      connectionManager,
    ];

    managers.forEach((manager) => bindMethods(this, manager));
  }

  /**
   * Starts a session for the specified network.
   * @returns {SupportedNetworkMap} A map of supported networks.
   */
  static start(): SupportedNetworkMap {
    return Object.fromEntries(
      Object.entries(SupportedNetwork).map(([networkKey, networkValue]) => [
        networkKey,
        (customWsUrl?: string) =>
          new NetworkBuilder(
            zkVerifySession._startSession.bind(zkVerifySession),
            networkValue,
            customWsUrl,
          ),
      ]),
    ) as SupportedNetworkMap;
  }

  /**
   * Getter for the Polkadot.js API instance.
   * @returns {ApiPromise} The API instance.
   */
  get api(): ApiPromise {
    return this.connectionManager.api;
  }

  /**
   * Getter for the WebSocket provider.
   * @returns {WsProvider} The WebSocket provider.
   */
  get provider(): WsProvider {
    return this.connectionManager.provider;
  }

  /**
   * Retrieves information for all active accounts in the current session.
   *
   * @returns {Promise<AccountInfo[]>} A promise that resolves to an array of AccountInfo objects,
   * representing all accounts in the session. As no accountIdentifier is provided for the call, all accounts are returned.
   * @throws {Error} If no accounts are found in the session.
   */
  get accountInfo(): Promise<AccountInfo[]> {
    return this.connectionManager
      .getAccountInfo()
      .then((result) => (Array.isArray(result) ? result : [result]));
  }

  /**
   * Getter for connection details.
   * @returns {AccountConnection | WalletConnection | EstablishedConnection} The connection details.
   */
  get connection():
    | AccountConnection
    | WalletConnection
    | EstablishedConnection {
    return this.connectionManager;
  }

  /**
   * Checks if the session is in read-only mode.
   * @returns {boolean} True if read-only, otherwise false.
   */
  get readOnly(): boolean {
    return this.connectionManager.readOnly;
  }

  /**
   * Initializes a new zkVerifySession instance.
   * @param {zkVerifySessionOptions} options - The session configuration options.
   * @returns {Promise<zkVerifySession>} A promise resolving to the zkVerifySession instance.
   */
  private static async _startSession(
    options: zkVerifySessionOptions,
  ): Promise<zkVerifySession> {
    try {
      const connectionManager = await ConnectionManager.createSession(options);
      return new zkVerifySession(connectionManager);
    } catch (error) {
      console.error(
        `❌ Failed to start session for network: ${options.host}`,
        error,
      );
      throw error;
    }
  }
}
