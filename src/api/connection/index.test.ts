import { ApiPromise, WsProvider } from '@polkadot/api';
import { establishConnection } from './index';
import { waitForNodeToSync } from '../../utils/helpers';
import { zkvTypes, zkvRpc, SupportedNetwork } from '../../config';

jest.mock('@polkadot/api');
jest.mock('../../utils/helpers');
jest.mock('../../config', () => ({
  zkvTypes: {},
  zkvRpc: {},
  SupportedNetwork: {
    Testnet: 'wss://testnet-rpc.zkverify.io',
    Custom: 'custom',
    Volta: 'wss://volta-rpc.zkverify.io',
  },
}));

describe('establishConnection', () => {
  let mockApiPromiseCreate: jest.MockedFunction<typeof ApiPromise.create>;
  let mockWsProvider: jest.Mocked<WsProvider>;
  let mockWaitForNodeToSync: jest.MockedFunction<typeof waitForNodeToSync>;

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

    mockApiPromiseCreate.mockResolvedValue({
      provider: mockWsProvider,
    } as unknown as ApiPromise);

    mockWaitForNodeToSync.mockResolvedValue(undefined);
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
        types: zkvTypes,
        rpc: zkvRpc,
      }),
    );
  };

  it('should establish a connection successfully on a predefined network (Volta)', async () => {
    const result = await establishConnection(SupportedNetwork.Volta);

    expect(WsProvider).toHaveBeenCalledWith(SupportedNetwork.Volta);
    expectApiPromiseCreateToHaveBeenCalledWith();
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api);
    expect(result.api).toBeDefined();
    expect(result.provider).toBeDefined();
  });

  it('should establish a connection successfully on a custom network', async () => {
    const customUrl = 'ws://custom-url';
    const result = await establishConnection(
      SupportedNetwork.Custom,
      customUrl,
    );

    expect(WsProvider).toHaveBeenCalledWith(customUrl);
    expectApiPromiseCreateToHaveBeenCalledWith();
    expect(waitForNodeToSync).toHaveBeenCalledWith(result.api);
    expect(result.api).toBeDefined();
    expect(result.provider).toBeDefined();
  });

  it('should throw an error if custom WebSocket URL is missing when host is custom', async () => {
    await expect(establishConnection(SupportedNetwork.Custom)).rejects.toThrow(
      'Custom WebSocket URL must be provided when host is set to "custom".',
    );
  });

  it('should throw an error if a custom WebSocket URL is provided but the host is not custom', async () => {
    await expect(
      establishConnection(SupportedNetwork.Volta, 'ws://custom-url'),
    ).rejects.toThrow(
      'Custom WebSocket URL provided. Please select "custom" as the host if you want to use a custom WebSocket endpoint.',
    );
  });

  it('should throw an error if ApiPromise.create fails', async () => {
    mockApiPromiseCreate.mockRejectedValueOnce(
      new Error('API creation failed'),
    );

    await expect(establishConnection(SupportedNetwork.Volta)).rejects.toThrow(
      'Failed to establish connection to wss://volta-rpc.zkverify.io: API creation failed',
    );
  });

  it('should throw a generic error if an unknown error occurs during connection', async () => {
    mockApiPromiseCreate.mockRejectedValueOnce('Unknown error');

    await expect(establishConnection(SupportedNetwork.Volta)).rejects.toThrow(
      'Failed to establish connection due to an unknown error.',
    );
  });
});
