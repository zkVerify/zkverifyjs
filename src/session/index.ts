import { ConnectionManager } from './managers/connection/index.js';
import { VerificationManager } from './managers/verification/index.js';
import { VerificationKeyRegistrationManager } from './managers/register/index.js';
import { EventManager } from './managers/events/index.js';
import { ExtrinsicManager } from './managers/extrinsic/index.js';
import { DomainManager } from './managers/domain/index.js';
import { zkVerifySessionOptions } from './types.js';
import { SupportedNetwork, SupportedNetworkConfig } from '../config/index.js';
import {
  NetworkBuilder,
  SupportedNetworkMap,
} from './builders/network/index.js';
import { FormatManager } from './managers/format/index.js';
import { RpcManager } from './managers/rpc/index.js';
import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  AccountConnection,
  WalletConnection,
  EstablishedConnection,
} from '../api/connection/types.js';
import { CustomNetworkConfig } from '../types.js';

export class zkVerifySession {
  private readonly connectionManager: ConnectionManager;
  private readonly verificationManager: VerificationManager;
  private readonly vkRegistrationManager: VerificationKeyRegistrationManager;
  private readonly eventManager: EventManager;
  private readonly extrinsicManager: ExtrinsicManager;
  private readonly domainManager: DomainManager;
  private readonly formatManager: FormatManager;
  private readonly rpcManager: RpcManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.verificationManager = new VerificationManager(connectionManager);
    this.vkRegistrationManager = new VerificationKeyRegistrationManager(
      connectionManager,
    );
    this.eventManager = new EventManager(connectionManager);
    this.extrinsicManager = new ExtrinsicManager(connectionManager);
    this.domainManager = new DomainManager(connectionManager);
    this.formatManager = new FormatManager();
    this.rpcManager = new RpcManager(connectionManager);
  }

  verify: VerificationManager['verify'] = (...args) =>
    this.verificationManager.verify(...args);
  optimisticVerify: VerificationManager['optimisticVerify'] = (...args) =>
    this.verificationManager.optimisticVerify(...args);
  batchVerify: VerificationManager['batchVerify'] = (...args) =>
    this.verificationManager.batchVerify(...args);
  batchOptimisticVerify: VerificationManager['batchOptimisticVerify'] = (
    ...args
  ) => this.verificationManager.batchOptimisticVerify(...args);

  registerVerificationKey: VerificationKeyRegistrationManager['registerVerificationKey'] =
    (...args) => this.vkRegistrationManager.registerVerificationKey(...args);

  format: FormatManager['format'] = (...args) =>
    this.formatManager.format(...args);
  formatVk: FormatManager['formatVk'] = (...args) =>
    this.formatManager.formatVk(...args);

  subscribe: EventManager['subscribe'] = (...args) =>
    this.eventManager.subscribe(...args);
  unsubscribe: EventManager['unsubscribe'] = (...args) =>
    this.eventManager.unsubscribe(...args);
  waitForAggregationReceipt: EventManager['waitForAggregationReceipt'] = (
    ...args
  ) => this.eventManager.waitForAggregationReceipt(...args);

  estimateCost: ExtrinsicManager['estimateCost'] = (...args) =>
    this.extrinsicManager.estimateCost(...args);
  createSubmitProofExtrinsic: ExtrinsicManager['createSubmitProofExtrinsic'] = (
    ...args
  ) => this.extrinsicManager.createSubmitProofExtrinsic(...args);
  createExtrinsicHex: ExtrinsicManager['createExtrinsicHex'] = (...args) =>
    this.extrinsicManager.createExtrinsicHex(...args);
  createExtrinsicFromHex: ExtrinsicManager['createExtrinsicFromHex'] = (
    ...args
  ) => this.extrinsicManager.createExtrinsicFromHex(...args);

  close: ConnectionManager['close'] = (...args) =>
    this.connectionManager.close(...args);
  addAccount: ConnectionManager['addAccount'] = (...args) =>
    this.connectionManager.addAccount(...args);
  addAccounts: ConnectionManager['addAccounts'] = (...args) =>
    this.connectionManager.addAccounts(...args);
  addDerivedAccounts: ConnectionManager['addDerivedAccounts'] = (...args) =>
    this.connectionManager.addDerivedAccounts(...args);
  removeAccount: ConnectionManager['removeAccount'] = (...args) =>
    this.connectionManager.removeAccount(...args);
  getAccount: ConnectionManager['getAccount'] = (...args) =>
    this.connectionManager.getAccount(...args);
  getAccountInfo: ConnectionManager['getAccountInfo'] = (...args) =>
    this.connectionManager.getAccountInfo(...args);

  registerDomain: DomainManager['registerDomain'] = (...args) =>
    this.domainManager.registerDomain(...args);
  unregisterDomain: DomainManager['unregisterDomain'] = (...args) =>
    this.domainManager.unregisterDomain(...args);
  holdDomain: DomainManager['holdDomain'] = (...args) =>
    this.domainManager.holdDomain(...args);
  aggregate: DomainManager['aggregate'] = (...args) =>
    this.domainManager.aggregate(...args);
  addDomainSubmitters: DomainManager['addDomainSubmitters'] = (...args) =>
    this.domainManager.addDomainSubmitters(...args);
  removeDomainSubmitters: DomainManager['removeDomainSubmitters'] = (...args) =>
    this.domainManager.removeDomainSubmitters(...args);

  getAggregateStatementPath: RpcManager['getAggregateStatementPath'] = (
    ...args
  ) => this.rpcManager.getAggregateStatementPath(...args);
  getVkHash: RpcManager['getVkHash'] = (...args) =>
    this.rpcManager.getVkHash(...args);

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
    AccountConnection | WalletConnection | EstablishedConnection {
    return this.connectionManager.connectionDetails;
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
