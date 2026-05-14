import { ApiPromise, WsProvider } from '@polkadot/api';
import { EstablishedConnection } from './types.js';
import {
  waitForNodeToSync,
  fetchRuntimeVersionFromProvider,
} from '../../utils/helpers/index.js';
import { getZkvTypes, zkvRpc } from '../../config/index.js';
import { NetworkConfig } from '../../types.js';

/**
 * Establishes a connection to the zkVerify blockchain by initializing the API and provider.
 *
 * @param config - NetworkConfig object containing details such as websocket and rpc urls.
 * @returns {Promise<EstablishedConnection>} The initialized API and provider.
 * @throws Will throw an error if the connection fails or if the provided configuration is invalid.
 */
export const establishConnection = async (
  config: NetworkConfig,
): Promise<EstablishedConnection> => {
  const { host, websocket } = config;

  if (!websocket || websocket.trim() === '') {
    throw new Error(`WebSocket URL is required for network: ${host}`);
  }

  try {
    const wsOpts = config.wsProvider;
    const provider =
      wsOpts !== undefined
        ? new WsProvider(
            websocket,
            wsOpts.autoConnectMs,
            undefined,
            wsOpts.timeout,
          )
        : new WsProvider(websocket);
    const runtimeSpec = await fetchRuntimeVersionFromProvider(provider);

    const api = await ApiPromise.create({
      provider,
      types: getZkvTypes(runtimeSpec),
      rpc: zkvRpc,
    });

    await waitForNodeToSync(api, { timeoutMs: config.syncTimeoutMs });

    return { api, provider, runtimeSpec };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to establish connection to ${host}: ${error.message}`,
      );
    } else {
      throw new Error(
        'Failed to establish connection due to an unknown error.',
      );
    }
  }
};
