import { WsProvider } from '@polkadot/api';
import { fetchRuntimeVersionFromProvider } from './index.js';

describe('fetchRuntimeVersionFromProvider', () => {
  it('waits for the WebSocket provider before sending runtime RPC', async () => {
    let resolveReady!: (provider: WsProvider) => void;
    const isReady = new Promise<WsProvider>((resolve) => {
      resolveReady = resolve;
    });
    const provider = {
      isReady,
      send: jest.fn().mockResolvedValue({
        specVersion: 1006000,
        specName: 'zkverify',
      }),
    } as unknown as WsProvider;

    const runtimeSpecPromise = fetchRuntimeVersionFromProvider(provider);

    await Promise.resolve();
    expect(provider.send).not.toHaveBeenCalled();

    resolveReady(provider);

    await expect(runtimeSpecPromise).resolves.toEqual({
      specVersion: 1006000,
      specName: 'zkverify',
    });
    expect(provider.send).toHaveBeenCalledWith('state_getRuntimeVersion', []);
  });
});
