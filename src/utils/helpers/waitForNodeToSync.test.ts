import { ApiPromise } from '@polkadot/api';
import { waitForNodeToSync } from './index.js';

type HealthMock = jest.Mock<Promise<{ isSyncing: { isTrue: boolean } }>>;

function makeApi(health: HealthMock): ApiPromise {
  return {
    rpc: {
      system: {
        health,
      },
    },
  } as unknown as ApiPromise;
}

describe('waitForNodeToSync', () => {
  it('resolves immediately when the node is already synced', async () => {
    const health = jest
      .fn()
      .mockResolvedValue({ isSyncing: { isTrue: false } }) as HealthMock;
    const api = makeApi(health);

    await expect(waitForNodeToSync(api)).resolves.toBeUndefined();
    expect(health).toHaveBeenCalledTimes(1);
  });

  it('polls until the node reports synced', async () => {
    let calls = 0;
    const health = jest.fn().mockImplementation(async () => {
      calls += 1;
      return { isSyncing: { isTrue: calls < 3 } };
    }) as HealthMock;
    const api = makeApi(health);

    await expect(
      waitForNodeToSync(api, { pollIntervalMs: 5, timeoutMs: 1000 }),
    ).resolves.toBeUndefined();
    expect(health).toHaveBeenCalledTimes(3);
  });

  it('throws when the deadline is exceeded', async () => {
    const health = jest
      .fn()
      .mockResolvedValue({ isSyncing: { isTrue: true } }) as HealthMock;
    const api = makeApi(health);

    await expect(
      waitForNodeToSync(api, { pollIntervalMs: 10, timeoutMs: 30 }),
    ).rejects.toThrow(/timed out after 30ms/);
  });

  it('aborts when the supplied signal fires', async () => {
    const health = jest
      .fn()
      .mockResolvedValue({ isSyncing: { isTrue: true } }) as HealthMock;
    const api = makeApi(health);
    const controller = new AbortController();

    const promise = waitForNodeToSync(api, {
      pollIntervalMs: 50,
      timeoutMs: 60_000,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 10);

    await expect(promise).rejects.toThrow(/aborted/);
  });

  it('refuses to start when the signal is already aborted', async () => {
    const health = jest.fn() as HealthMock;
    const api = makeApi(health);
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForNodeToSync(api, { signal: controller.signal }),
    ).rejects.toThrow(/aborted/);
    expect(health).not.toHaveBeenCalled();
  });
});
