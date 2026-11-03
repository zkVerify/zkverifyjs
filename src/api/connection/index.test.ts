import { ApiPromise, WsProvider } from '@polkadot/api';
import { establishConnection } from './index.js';
import {
  waitForNodeToSync,
  fetchRuntimeVersionFromProvider,
} from '../../utils/helpers/index.js';
import {
  getZkvTypesBundle,
  zkvRpc,
  SupportedNetwork,
} from '../../config/index.js';
import { NetworkConfig } from '../../types.js';

jest.mock('@polkadot/api');
jest.mock('../../utils/helpers');
jest.mock('../../config', () => ({
  getZkvTypesBundle: jest.fn(),
  zkvRpc: {},
  SupportedNetwork: {
    Custom: 'Custom',
    Volta: 'Volta',
  },
}));

describe('establishConnection', () => {
  let mockApiPromiseCreate: jest.MockedFunction<typeof ApiPromise.create>;
  let mockWsProvider: jest.Mocked<WsProvider>;
  let mockWaitForNodeToSync: jest.MockedFunction<typeof waitForNodeToSync>;
  let mockFetchRuntimeVersionFromProvider: jest.MockedFunction<
    typeof fetchRuntimeVersionFromProvider
  >;
  let mockGetZkvTypesBundle: jest.MockedFunction<typeof getZkvTypesBundle>;
  let mockApi: ApiPromise;

  beforeEach(() => {
    mockApiPromiseCreate = ApiPromise.create as jest.MockedFunction<
      typeof ApiPromise.create
    >;
    mockWsProvider = new WsProvider(
      'ws://localhost',
    ) as jest.Mocked<WsProvider>;
    mockWaitForNodeToSync = waitForNodeToSync as jest.MockedFunction<
      typeof waitForNodeToSync
    >;
    mockFetchRuntimeVersionFromProvider =
      fetchRuntimeVersionFromProvider as jest.MockedFunction<
        typeof fetchRuntimeVersionFromProvider
      >;
    mockGetZkvTypesBundle = getZkvTypesBundle as jest.MockedFunction<
      typeof getZkvTypesBundle
    >;
    mockApi = {
      provider: mockWsProvider,
    } as unknown as ApiPromise;

    mockApiPromiseCreate.mockResolvedValue(mockApi);

    mockWaitForNodeToSync.mockResolvedValue(undefined);
    mockFetchRuntimeVersionFromProvider.mockResolvedValue({
      specVersion: 1003000,
      specName: 'test-runtime',
    });
    mockGetZkvTypesBundle.mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const expectApiPromiseCreateToHaveBeenCalledWith = () => {
    expect(ApiPromise.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({
          connect: expect.any(Function),
          disconnect: expect.any(Function),
          send: expect.any(Function),
        }),
        typesBundle: {},
        rpc: zkvRpc,
      }),
    );
  };

  it('should establish a connection successfully on a predefined network (Volta)', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    const result = await establishConnection(networkConfig);

    expect(WsProvider).toHaveBeenCalledWith(networkConfig.websocket);
    expectApiPromiseCreateToHaveBeenCalledWith();
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api, {
      timeoutMs: undefined,
    });
    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(getZkvTypesBundle).toHaveBeenCalledWith('test-runtime');
    expect(result.api).toBeDefined();
    expect(result.provider).toBeDefined();
    expect(result.runtimeSpec).toBeDefined();
    expect(result.runtimeSpec.specVersion).toBe(1003000);
    expect(result.runtimeSpec.specName).toBe('test-runtime');
  });

  it('should establish a connection successfully on a custom network', async () => {
    const customUrl = 'ws://custom-url';
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Custom,
      websocket: 'ws://custom-url',
      rpc: 'http://custom-rpc-url',
    };

    const result = await establishConnection(networkConfig);

    expect(WsProvider).toHaveBeenCalledWith(customUrl);
    expectApiPromiseCreateToHaveBeenCalledWith();
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api, {
      timeoutMs: undefined,
    });
    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(result.api).toBeDefined();
    expect(result.provider).toBeDefined();
    expect(result.runtimeSpec).toBeDefined();
  });

  it('should fetch runtime before creating the API with a spec-versioned types bundle', async () => {
    const runtimeSpec = {
      specVersion: 1006000,
      specName: 'test-runtime',
    };
    const bundle = { spec: { 'test-runtime': { types: [] } } };
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    mockFetchRuntimeVersionFromProvider.mockResolvedValue(runtimeSpec);
    mockGetZkvTypesBundle.mockReturnValue(bundle);

    const result = await establishConnection(networkConfig);

    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(getZkvTypesBundle).toHaveBeenCalledWith('test-runtime');
    expect(ApiPromise.create).toHaveBeenCalledWith(
      expect.objectContaining({
        typesBundle: bundle,
      }),
    );
    expect(ApiPromise.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ types: expect.anything() }),
    );
    expect(
      mockFetchRuntimeVersionFromProvider.mock.invocationCallOrder[0],
    ).toBeLessThan(mockGetZkvTypesBundle.mock.invocationCallOrder[0]);
    expect(mockGetZkvTypesBundle.mock.invocationCallOrder[0]).toBeLessThan(
      mockApiPromiseCreate.mock.invocationCallOrder[0],
    );
  });

  it('should track runtime upgrades on an open connection', async () => {
    let specVersion = 2000000;
    mockApiPromiseCreate.mockResolvedValue({
      provider: mockWsProvider,
      get runtimeVersion() {
        return { specVersion: { toNumber: () => specVersion } };
      },
    } as unknown as ApiPromise);
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    const result = await establishConnection(networkConfig);
    expect(result.runtimeSpec.specVersion).toBe(2000000);

    specVersion = 2001000;
    expect(result.runtimeSpec.specVersion).toBe(2001000);
    expect(result.runtimeSpec.specName).toBe('test-runtime');
  });

  it('should fall back to the initial spec version while the API is not initialised', async () => {
    mockApiPromiseCreate.mockResolvedValue({
      provider: mockWsProvider,
      get runtimeVersion() {
        throw new Error('not initialised');
      },
    } as unknown as ApiPromise);
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    const result = await establishConnection(networkConfig);

    expect(result.runtimeSpec.specVersion).toBe(1003000);
  });

  it('should throw an error if custom WebSocket URL is missing when host is custom', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Custom,
      websocket: '',
      rpc: 'http://custom-rpc-url',
    };

    await expect(establishConnection(networkConfig)).rejects.toThrow(
      'WebSocket URL is required for network: Custom',
    );
  });

  describe('WebSocket URL validation', () => {
    const customConfig = (
      websocket: string,
      extra: Partial<NetworkConfig> = {},
    ): NetworkConfig => ({
      host: SupportedNetwork.Custom,
      websocket,
      rpc: 'https://custom-rpc-url',
      ...extra,
    });

    // Warns rather than rejects: plaintext endpoints worked in earlier releases, so
    // failing here would break consumers pointing at a private node.
    it('warns but still connects for plaintext ws:// to a non-loopback host', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await expect(
          establishConnection(customConfig('ws://node.example.com:9944')),
        ).resolves.toBeDefined();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('unencrypted ws://'),
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('never prints credentials or paths from the endpoint URL', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await establishConnection(
          customConfig('ws://ops:S3cret@node.example.com:9944/key?token=abc'),
        );
        const message = String(warn.mock.calls[0][0]);
        expect(message).toContain('ws://node.example.com:9944');
        expect(message).not.toContain('S3cret');
        expect(message).not.toContain('ops');
        expect(message).not.toContain('/key');
        expect(message).not.toContain('token=abc');

        await expect(
          establishConnection(
            customConfig('https://ops:S3cret@node.example.com/key?token=abc'),
          ),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.not.stringContaining('S3cret'),
          }),
        );
        await expect(
          establishConnection(customConfig('ws://ops:S3cret@not a url')),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.not.stringContaining('S3cret'),
          }),
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn when allowInsecureWebSocket is set', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await establishConnection(
          customConfig('ws://node.example.com:9944', {
            allowInsecureWebSocket: true,
          }),
        );
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn for loopback hosts', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await establishConnection(customConfig('ws://127.0.0.1:9944'));
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('allows plaintext ws:// to loopback hosts without an opt-in', async () => {
      for (const url of [
        'ws://localhost:9944',
        'ws://custom-url',
        'ws://[::1]:9944',
      ]) {
        await expect(
          establishConnection(customConfig(url)),
        ).resolves.toBeDefined();
      }
    });

    // Already failed inside WsProvider (which requires /^(wss|ws):\/\//); this just
    // reports it earlier and more clearly.
    it('rejects an unparseable URL', async () => {
      await expect(
        establishConnection(customConfig('not a url')),
      ).rejects.toThrow(/Invalid WebSocket URL/);
      expect(ApiPromise.create).not.toHaveBeenCalled();
    });

    it('rejects an unsupported scheme', async () => {
      await expect(
        establishConnection(customConfig('https://node.example.com')),
      ).rejects.toThrow(/Unsupported WebSocket protocol "https:"/);
      expect(ApiPromise.create).not.toHaveBeenCalled();
    });

    it('accepts wss://', async () => {
      await expect(
        establishConnection(customConfig('wss://node.example.com')),
      ).resolves.toBeDefined();
    });
  });

  it('should throw an error if ApiPromise.create fails', async () => {
    mockApiPromiseCreate.mockRejectedValueOnce(
      new Error('API creation failed'),
    );

    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    await expect(establishConnection(networkConfig)).rejects.toThrow(
      'Failed to establish connection to Volta: API creation failed',
    );
  });

  it('should throw a generic error if an unknown error occurs during connection', async () => {
    mockApiPromiseCreate.mockRejectedValueOnce('Unknown error');

    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    await expect(establishConnection(networkConfig)).rejects.toThrow(
      'Failed to establish connection due to an unknown error.',
    );
  });

  it('uses default WsProvider construction when wsProvider is omitted', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    await establishConnection(networkConfig);

    expect(WsProvider).toHaveBeenCalledWith(networkConfig.websocket);
    expect(WsProvider).toHaveBeenCalledTimes(2);
  });

  it('passes autoConnectMs and timeout to WsProvider when wsProvider is set', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Custom,
      websocket: 'ws://custom-url',
      rpc: 'http://custom-rpc-url',
      wsProvider: { autoConnectMs: 10_000, timeout: 30_000 },
    };

    await establishConnection(networkConfig);

    expect(WsProvider).toHaveBeenLastCalledWith(
      'ws://custom-url',
      10_000,
      undefined,
      30_000,
    );
  });

  it('honors autoConnectMs: false to disable auto-reconnect', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Custom,
      websocket: 'ws://custom-url',
      rpc: 'http://custom-rpc-url',
      wsProvider: { autoConnectMs: false },
    };

    await establishConnection(networkConfig);

    expect(WsProvider).toHaveBeenLastCalledWith(
      'ws://custom-url',
      false,
      undefined,
      undefined,
    );
  });

  it('threads syncTimeoutMs through to waitForNodeToSync', async () => {
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Custom,
      websocket: 'ws://custom-url',
      rpc: 'http://custom-rpc-url',
      syncTimeoutMs: 60_000,
    };

    const result = await establishConnection(networkConfig);

    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api, {
      timeoutMs: 60_000,
    });
  });
});
