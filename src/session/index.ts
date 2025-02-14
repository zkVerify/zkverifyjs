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
  declare removeAccount: ConnectionManager['removeAccount'];

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

  get api(): ApiPromise {
    return this.connectionManager.api;
  }

  get provider(): WsProvider {
    return this.connectionManager.provider;
  }

  get accountInfo(): Promise<AccountInfo> {
    return this.connectionManager.getAccountInfo();
  }

  get connection():
    | AccountConnection
    | WalletConnection
    | EstablishedConnection {
    return this.connectionManager;
  }

  get readOnly(): boolean {
    return this.connectionManager.readOnly;
  }

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
