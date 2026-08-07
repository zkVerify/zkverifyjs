import { WsProvider, ApiPromise } from '@polkadot/api';

export async function closeSession(provider: WsProvider): Promise<void> {
  if (!provider) {
    return;
  }

  const disconnectWithRetries = async (
    name: string,
    disconnectFn: () => Promise<void>,
    isConnectedFn: () => boolean,
  ) => {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await disconnectFn();
        if (!isConnectedFn()) return;
      } catch (error) {
        console.debug(`Retrying ${name} disconnect due to error:`, error);
      }
      if (attempt < maxAttempts - 1) {
        const delayMs = Math.min(100 * 2 ** attempt, 1000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    console.warn(`Failed to disconnect ${name} after ${maxAttempts} attempts.`);
  };

  try {
    const apiInstances = (provider as unknown as { _apis?: ApiPromise[] })
      ._apis;
    if (apiInstances?.length) {
      await Promise.all(
        apiInstances.map(async (api) => {
          try {
            await api?.disconnect();
          } catch (error) {
            console.debug('Error disconnecting API instance:', error);
          }
        }),
      );
    }
  } catch (error) {
    console.debug('Error while unsubscribing API instances:', error);
  }

  try {
    if ('removeAllListeners' in provider) {
      (
        provider as unknown as { removeAllListeners: () => void }
      ).removeAllListeners();
    }
  } catch (error) {
    console.debug('Error while removing event listeners:', error);
  }

  // disconnect() must run even when the socket is already down: it zeroes
  // WsProvider's autoConnectMs, disarming the auto-reconnect that would
  // otherwise resurrect the closed session.
  try {
    await disconnectWithRetries(
      'Provider',
      () => provider.disconnect(),
      () => provider.isConnected,
    );
  } catch (error) {
    console.warn('Provider disconnection failed:', error);
  }
}
