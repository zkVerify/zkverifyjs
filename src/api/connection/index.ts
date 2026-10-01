import { ApiPromise, WsProvider } from '@polkadot/api';
import { EstablishedConnection } from './types.js';
import {
  waitForNodeToSync,
  fetchRuntimeVersionFromProvider,
} from '../../utils/helpers/index.js';
import { getZkvTypes, zkvRpc } from '../../config/index.js';
import { NetworkConfig } from '../../types.js';

/**
 * Hosts for which an unencrypted `ws://` connection is always acceptable, since the
 * traffic never leaves the machine.
 */
const isLoopbackHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|]$/g, '');

  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
};

/**
 * Validates a caller-supplied WebSocket endpoint before it is used to establish a
 * session.
 *
 * `Custom` network configuration is passed through from the consumer, so this is the
 * only place a malformed or downgraded endpoint can be caught. Plaintext `ws://` to a
 * non-loopback host is warned about rather than rejected, to stay compatible with
 * existing consumers; everything rejected here already failed inside `WsProvider`,
 * which requires an endpoint matching `/^(wss|ws):\/\//`.
 *
 * @throws {Error} If the URL is missing, unparseable, or uses an unsupported scheme.
 */
const validateWebSocketUrl = (config: NetworkConfig): string => {
  const { host, websocket, allowInsecureWebSocket } = config;

  if (!websocket || websocket.trim() === '') {
    throw new Error(`WebSocket URL is required for network: ${host}`);
  }

  const url = websocket.trim();
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Invalid WebSocket URL for network ${host}: "${url}". ` +
        `Expected a URL such as "wss://your-node.example:443".`,
    );
  }

  if (parsed.protocol === 'wss:') {
    return url;
  }

  if (parsed.protocol === 'ws:') {
    // Warn rather than reject: plaintext endpoints worked in earlier releases, and
    // failing here would break existing consumers pointing at a private node. The
    // risk is surfaced instead, and `allowInsecureWebSocket` silences the warning.
    if (!isLoopbackHost(parsed.hostname) && !allowInsecureWebSocket) {
      console.warn(
        `zkverifyjs: connecting to network ${host} over unencrypted ws:// ("${url}"). ` +
          `On a plaintext connection an attacker in a network position can forge the ` +
          `chain state this SDK reports, including proof verification results. ` +
          `Prefer wss://. Set allowInsecureWebSocket: true to silence this warning ` +
          `if this is a trusted private network you control.`,
      );
    }

    return url;
  }

  throw new Error(
    `Unsupported WebSocket protocol "${parsed.protocol}" for network ${host} ` +
      `("${url}"). Expected wss:// (or ws:// for local development).`,
  );
};

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
  const { host } = config;

  const websocket = validateWebSocketUrl(config);

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
