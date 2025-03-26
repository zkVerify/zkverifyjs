import { ApiPromise, WsProvider } from '@polkadot/api';
import { EstablishedConnection } from './types';
import { waitForNodeToSync } from '../../utils/helpers';
import { zkvTypes, zkvRpc } from '../../config';
import { NetworkConfig } from '../../types';

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
    const provider = new WsProvider(websocket);

    const api = await ApiPromise.create({
      provider,
      types: zkvTypes,
      rpc: zkvRpc,
    });

    await waitForNodeToSync(api);

    return { api, provider };
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
