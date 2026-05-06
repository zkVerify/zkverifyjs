import { ApiPromise, WsProvider } from '@polkadot/api';
import { establishConnection } from './index';
import {
  waitForNodeToSync,
  fetchRuntimeVersionFromProvider,
} from '../../utils/helpers';
import { getZkvTypes, zkvRpc, SupportedNetwork } from '../../config';
import { NetworkConfig } from '../../types';

jest.mock('@polkadot/api');
jest.mock('../../utils/helpers');
jest.mock('../../config', () => ({
  getZkvTypes: jest.fn(),
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
  let mockGetZkvTypes: jest.MockedFunction<typeof getZkvTypes>;
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
    mockGetZkvTypes = getZkvTypes as jest.MockedFunction<typeof getZkvTypes>;
    mockApi = {
      provider: mockWsProvider,
    } as unknown as ApiPromise;

    mockApiPromiseCreate.mockResolvedValue(mockApi);

    mockWaitForNodeToSync.mockResolvedValue(undefined);
    mockFetchRuntimeVersionFromProvider.mockResolvedValue({
      specVersion: 1003000,
      specName: 'test-runtime',
    });
    mockGetZkvTypes.mockReturnValue({});
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
        types: {},
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
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api);
    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(getZkvTypes).toHaveBeenCalledWith(result.runtimeSpec);
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
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api);
    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(result.api).toBeDefined();
    expect(result.provider).toBeDefined();
    expect(result.runtimeSpec).toBeDefined();
  });

  it('should fetch runtime before creating the API with runtime-specific types', async () => {
    const runtimeSpec = {
      specVersion: 1006000,
      specName: 'test-runtime',
    };
    const runtimeTypes = { UltraHonkVk: { _enum: { V3_0: 'Bytes' } } };
    const networkConfig: NetworkConfig = {
      host: SupportedNetwork.Volta,
      websocket: 'wss://volta-rpc.zkverify.io',
      rpc: 'http://volta-rpc.zkverify.io',
    };

    mockFetchRuntimeVersionFromProvider.mockResolvedValue(runtimeSpec);
    mockGetZkvTypes.mockReturnValue(runtimeTypes);

    const result = await establishConnection(networkConfig);

    expect(fetchRuntimeVersionFromProvider).toHaveBeenCalledWith(
      result.provider,
    );
    expect(getZkvTypes).toHaveBeenCalledWith(runtimeSpec);
    expect(ApiPromise.create).toHaveBeenCalledWith(
      expect.objectContaining({
        types: runtimeTypes,
      }),
    );
    expect(
      mockFetchRuntimeVersionFromProvider.mock.invocationCallOrder[0],
    ).toBeLessThan(mockGetZkvTypes.mock.invocationCallOrder[0]);
    expect(mockGetZkvTypes.mock.invocationCallOrder[0]).toBeLessThan(
      mockApiPromiseCreate.mock.invocationCallOrder[0],
    );
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
});
