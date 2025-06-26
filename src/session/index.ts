import { ConnectionManager } from './managers/connection';
import { VerificationManager } from './managers/verification';
import { VerificationKeyRegistrationManager } from './managers/register';
import { EventManager } from './managers/events';
import { ExtrinsicManager } from './managers/extrinsic';
import { DomainManager } from './managers/domain';
import { zkVerifySessionOptions } from './types';
import { SupportedNetwork, SupportedNetworkConfig } from '../config';
import { NetworkBuilder, SupportedNetworkMap } from './builders/network';
import { FormatManager } from './managers/format';
import { RpcManager } from './managers/rpc';
import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  AccountConnection,
  WalletConnection,
  EstablishedConnection,
} from '../api/connection/types';
import { bindMethods } from '../utils/helpers';
import { CustomNetworkConfig } from '../types';

export class zkVerifySession {
  private readonly connectionManager: ConnectionManager;

  declare verify: VerificationManager['verify'];
  declare optimisticVerify: VerificationManager['optimisticVerify'];
  declare batchVerify: VerificationManager['batchVerify'];
  declare batchOptimisticVerify: VerificationManager['batchOptimisticVerify'];
  declare registerVerificationKey: VerificationKeyRegistrationManager['registerVerificationKey'];
  declare format: FormatManager['format'];
  declare formatVk: FormatManager['formatVk'];
  declare subscribe: EventManager['subscribe'];
  declare unsubscribe: EventManager['unsubscribe'];
  declare waitForAggregationReceipt: EventManager['waitForAggregationReceipt'];
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
  declare registerDomain: DomainManager['registerDomain'];
  declare unregisterDomain: DomainManager['unregisterDomain'];
  declare holdDomain: DomainManager['holdDomain'];
  declare aggregate: DomainManager['aggregate'];
  declare getAggregateStatementPath: RpcManager['getAggregateStatementPath'];
  declare getVkHash: RpcManager['getVkHash'];

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;

    const managers = [
      new VerificationManager(connectionManager),
      new VerificationKeyRegistrationManager(connectionManager),
      new EventManager(connectionManager),
      new ExtrinsicManager(connectionManager),
      new DomainManager(connectionManager),
      new FormatManager(),
      new RpcManager(connectionManager),
      connectionManager,
    ];

    managers.forEach((manager) => bindMethods(this, manager));
  }

  /**
   * Starts a session for the specified network.
   * @returns {SupportedNetworkMap} A map of supported networks.
   */
  static start(): SupportedNetworkMap {
    const map = {} as SupportedNetworkMap;

    for (const [key, config] of Object.entries(SupportedNetworkConfig)) {
      const network = key as SupportedNetwork;

      if (network === SupportedNetwork.Custom) {
        map[network] = (partialConfig: CustomNetworkConfig) =>
          new NetworkBuilder(
            zkVerifySession._startSession.bind(zkVerifySession),
            {
              ...partialConfig,
              host: SupportedNetwork.Custom,
            },
          );
      } else {
        map[network] = () =>
          new NetworkBuilder(
            zkVerifySession._startSession.bind(zkVerifySession),
            config,
          );
      }
    }

    return map;
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
      console.debug(
        `❌ Failed to start session for network: ${options.networkConfig.host}`,
        error,
      );
      throw error;
    }
  }
}
