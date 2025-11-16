import { ApiPromise, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { InjectedExtension } from '@polkadot/extension-inject/types';
import { LastRuntimeUpgrade } from '../../types';

export interface EstablishedConnection {
  api: ApiPromise;
  provider: WsProvider;
  runtimeVersion: LastRuntimeUpgrade;
}

export interface AccountConnection extends EstablishedConnection {
  accounts: Map<string, KeyringPair>;
}

export interface WalletConnection extends EstablishedConnection {
  injector: InjectedExtension;
  accountAddress: string;
}
