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
    let retries = 5;
    while (retries > 0) {
      try {
        await disconnectFn();
        if (!isConnectedFn()) return;
      } catch (error) {
        console.debug(`Retrying ${name} disconnect due to error:`, error);
      }
      retries--;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Failed to disconnect ${name} after 5 attempts.`);
  };

  try {
    const apiInstances = (provider as unknown as { _apis?: ApiPromise[] })
      ._apis;
    if (apiInstances?.length) {
      await Promise.all(
        apiInstances.map(async (api) => {
          if (api?.isConnected) {
            await api.disconnect();
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

  if (provider.isConnected) {
    try {
      await disconnectWithRetries(
        'Provider',
        () => provider.disconnect(),
        () => provider.isConnected,
      );
    } catch (error) {
      console.debug('Provider disconnection failed:', error);
      throw error;
    }
  }
}
