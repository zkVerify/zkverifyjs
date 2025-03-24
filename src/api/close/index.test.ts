import { WsProvider } from '@polkadot/api';
import { closeSession } from './index';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';

describe('closeSession', () => {
  let provider: jest.Mocked<WsProvider>;

  beforeEach(() => {
    provider = {
      disconnect: jest.fn().mockResolvedValue(undefined as never),
      isConnected: true,
    } as unknown as jest.Mocked<WsProvider>;

    Object.defineProperty(provider, 'isConnected', {
      get: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupProviderSpy = () => {
    return jest.spyOn(provider, 'disconnect') as jest.SpiedFunction<
      WsProvider['disconnect']
    >;
  };

  it('should disconnect provider successfully', async () => {
    jest
      .spyOn(provider, 'isConnected', 'get')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const providerDisconnectSpy = setupProviderSpy();

    await closeSession(provider);

    expect(providerDisconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('should not call provider.disconnect if provider is already disconnected', async () => {
    jest.spyOn(provider, 'isConnected', 'get').mockReturnValue(false);

    const providerDisconnectSpy = setupProviderSpy();

    await closeSession(provider);

    expect(providerDisconnectSpy).toHaveBeenCalledTimes(0);
  });

  it('should retry provider disconnect if it remains connected initially', async () => {
    const providerDisconnectSpy = setupProviderSpy();

    jest
      .spyOn(provider, 'isConnected', 'get')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await closeSession(provider);

    expect(providerDisconnectSpy).toHaveBeenCalledTimes(3);
  });
});
