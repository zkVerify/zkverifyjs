import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { EventEmitter } from 'events';
import { subscribeToNewAggregationReceipts, unsubscribe } from './index.js';
import { ZkVerifyEvents } from '../../enums.js';
import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import Mock = jest.Mock;

const createMockEventRecord = (
  section: string,
  method: string,
  data: any[],
  phaseData: any = { ApplyExtrinsic: 1 },
): EventRecord => {
  const mockData = data.map((d) => ({ toString: () => String(d) }));
  return {
    event: { section, method, data: mockData, toHuman: () => data.map(String) },
    phase: {
      toJSON: () => phaseData,
      toString: () => JSON.stringify(phaseData),
    },
  } as unknown as EventRecord;
};

describe('subscribeToNewAggregationReceipts', () => {
  let api: ApiPromise;
  let callback: jest.Mock;
  let mockApiUnsubscribe: jest.Mock<() => void>;
  let finalizedHeadsCallback: ((header: any) => Promise<void> | void) | null =
    null;
  let mockHeader: any;
  let emitter: EventEmitter;
  let mockEventsAt: jest.Mock<(blockHash: any) => Promise<any>>;

  beforeEach(() => {
    jest.useRealTimers();
    mockApiUnsubscribe = jest.fn();

    mockHeader = {
      hash: { toHex: () => '0xmockedhash' },
      number: { toNumber: () => 123, toBigInt: () => BigInt(123) },
    };

    mockEventsAt = jest
      .fn<(blockHash: any) => Promise<any>>()
      .mockImplementation(async () => Promise.resolve([] as any));

    api = {
      rpc: {
        chain: {
          subscribeFinalizedHeads: jest.fn(
            async (cb: (header: any) => Promise<void> | void) => {
              finalizedHeadsCallback = cb;
              return mockApiUnsubscribe;
            },
          ) as Mock,
        },
      },
      query: {
        system: {
          events: { at: mockEventsAt },
        },
      },
    } as unknown as ApiPromise;

    callback = jest.fn();
    emitter = new EventEmitter();
    finalizedHeadsCallback = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (emitter) {
      emitter.removeAllListeners();
    }
  });

  it('should emit event and RESOLVE when domainId and aggregationId match received event', async () => {
    const targetDomainId = 1;
    const targetAggregationId = 2;
    const receipt = '0xreceiptABC';
    const mockEvent = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      [targetDomainId, targetAggregationId, receipt],
    );

    mockEventsAt.mockImplementation(async () => Promise.resolve([mockEvent]));
    const emitSpy = jest.spyOn(emitter, 'emit');
    const subscriptionPromise = subscribeToNewAggregationReceipts(
      api,
      callback,
      { domainId: targetDomainId, aggregationId: targetAggregationId },
      emitter,
    );

    await new Promise((resolve) => setImmediate(resolve));
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');
    await finalizedHeadsCallback(mockHeader);

    await expect(subscriptionPromise).resolves.toBe(emitter);

    const expectedData = [
      String(targetDomainId),
      String(targetAggregationId),
      receipt,
    ];
    const expectedPhase = { ApplyExtrinsic: 1 };
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        event: ZkVerifyEvents.NewAggregationReceipt,
        blockHash: '0xmockedhash',
        data: expectedData,
        phase: expectedPhase,
      }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      ZkVerifyEvents.NewAggregationReceipt,
      expect.objectContaining({
        data: expectedData,
        phase: expectedPhase,
      }),
    );
    expect(mockApiUnsubscribe).toHaveBeenCalled();
    expect((emitter as any)._cleanups?.length ?? 0).toBe(0);
    expect(emitter.listenerCount(ZkVerifyEvents.Unsubscribe)).toBe(0);
  });

  it('should reject immediately if aggregationId is provided without domainId', async () => {
    await expect(
      subscribeToNewAggregationReceipts(
        api,
        callback,
        { aggregationId: 1 } as any,
        emitter,
      ),
    ).rejects.toThrow(
      'Cannot filter by aggregationId without also providing domainId.',
    );
    expect(api.rpc.chain.subscribeFinalizedHeads).not.toHaveBeenCalled();
  });

  it('should reject with timeout error if no matching event received within timeout', async () => {
    jest.useFakeTimers();
    const timeoutDuration = 10;
    mockEventsAt.mockImplementation(async () => Promise.resolve([]));
    const emitSpy = jest.spyOn(emitter, 'emit');
    const subscriptionPromise = subscribeToNewAggregationReceipts(
      api,
      callback,
      { domainId: 1, aggregationId: 2, timeout: timeoutDuration },
      emitter,
    );

    await Promise.resolve();
    jest.advanceTimersByTime(1);
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');

    const callbackPromise = finalizedHeadsCallback(mockHeader);
    await Promise.resolve();
    await callbackPromise;

    jest.advanceTimersByTime(timeoutDuration);
    await Promise.resolve();

    await expect(subscriptionPromise).rejects.toThrow(
      `Timeout exceeded: No event received within ${timeoutDuration} ms`,
    );
    // A timeout ends only this wait.
    expect(emitSpy).not.toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount(ZkVerifyEvents.Unsubscribe)).toBe(0);
    expect((emitter as any)._cleanups?.length ?? 0).toBe(0);
    jest.useRealTimers();
  });

  it('should emit Unsubscribe event and remove all listeners when unsubscribe() helper is called', () => {
    const emitSpy = jest.spyOn(emitter, 'emit');
    emitter.on('dummyEvent1', () => {});
    unsubscribe(emitter);
    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
    expect(emitter.listenerCount('dummyEvent1')).toBe(0);
    expect(emitter.eventNames().length).toBe(0);
  });

  it('should process all matching events and NOT resolve/unsubscribe when options are undefined', async () => {
    const mockEvent1 = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      ['1', '10', '0xA'],
    );
    const mockEvent2 = createMockEventRecord('system', 'ExtrinsicSuccess', []);
    const mockEvent3 = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      ['2', '20', '0xB'],
    );
    const emitSpy = jest.spyOn(emitter, 'emit');
    subscribeToNewAggregationReceipts(api, callback, undefined, emitter).catch(
      () => {},
    );

    await new Promise((resolve) => setImmediate(resolve));
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');

    mockEventsAt.mockImplementation(async () =>
      Promise.resolve([mockEvent1, mockEvent2]),
    );
    await finalizedHeadsCallback(mockHeader);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledTimes(1);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ data: ['1', '10', '0xA'] }),
    );
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      ZkVerifyEvents.NewAggregationReceipt,
      expect.objectContaining({ data: ['1', '10', '0xA'] }),
    );

    const header2 = {
      ...mockHeader,
      hash: { toHex: () => '0xhash2' },
      number: { toNumber: () => 124, toBigInt: () => BigInt(124) },
    };
    mockEventsAt.mockImplementation(async () => Promise.resolve([mockEvent3]));
    await finalizedHeadsCallback(header2);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: ['2', '20', '0xB'],
        blockHash: '0xhash2',
      }),
    );
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenNthCalledWith(
      2,
      ZkVerifyEvents.NewAggregationReceipt,
      expect.objectContaining({
        data: ['2', '20', '0xB'],
        blockHash: '0xhash2',
      }),
    );

    expect(mockApiUnsubscribe).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });

  it('should process only events matching domainId indefinitely when only domainId provided', async () => {
    const targetDomainId = 1;
    const mockEvent1 = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      [String(targetDomainId), '10', '0xA'],
    );
    const mockEventOtherDomain = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      ['99', '99', '0xOther'],
    );
    const mockEvent2 = createMockEventRecord(
      'aggregate',
      'NewAggregationReceipt',
      [String(targetDomainId), '20', '0xB'],
    );
    const emitSpy = jest.spyOn(emitter, 'emit');

    subscribeToNewAggregationReceipts(
      api,
      callback,
      { domainId: targetDomainId },
      emitter,
    ).catch(() => {});

    await new Promise((resolve) => setImmediate(resolve));
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');

    mockEventsAt.mockImplementation(async () => Promise.resolve([mockEvent1]));
    await finalizedHeadsCallback(mockHeader);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledTimes(1);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ data: [String(targetDomainId), '10', '0xA'] }),
    );
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      ZkVerifyEvents.NewAggregationReceipt,
      expect.objectContaining({ data: [String(targetDomainId), '10', '0xA'] }),
    );

    const header2 = {
      ...mockHeader,
      hash: { toHex: () => '0xhash2' },
      number: { toNumber: () => 124, toBigInt: () => BigInt(124) },
    };
    mockEventsAt.mockImplementation(async () =>
      Promise.resolve([mockEventOtherDomain]),
    );
    await finalizedHeadsCallback(header2);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledTimes(1);

    const header3 = {
      ...mockHeader,
      hash: { toHex: () => '0xhash3' },
      number: { toNumber: () => 125, toBigInt: () => BigInt(125) },
    };
    mockEventsAt.mockImplementation(async () => Promise.resolve([mockEvent2]));
    await finalizedHeadsCallback(header3);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: [String(targetDomainId), '20', '0xB'],
        blockHash: '0xhash3',
      }),
    );
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenNthCalledWith(
      2,
      ZkVerifyEvents.NewAggregationReceipt,
      expect.objectContaining({
        data: [String(targetDomainId), '20', '0xB'],
        blockHash: '0xhash3',
      }),
    );

    expect(mockApiUnsubscribe).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });
});

describe('subscribeToNewAggregationReceipts — bug fixes', () => {
  let api: ApiPromise;
  let mockApiUnsubscribe: jest.Mock<() => void>;
  let mockEventsAt: jest.Mock<(blockHash: any) => Promise<any>>;
  let resolveSubscribe!: (fn: () => void) => void;
  let rejectSubscribe!: (err: unknown) => void;

  beforeEach(() => {
    jest.useRealTimers();
    mockApiUnsubscribe = jest.fn();

    mockEventsAt = jest
      .fn<(blockHash: any) => Promise<any>>()
      .mockImplementation(async () => Promise.resolve([] as any));

    api = {
      rpc: {
        chain: {
          subscribeFinalizedHeads: jest.fn(() => {
            // Hand back a Promise we manually settle from the test, so we can
            // simulate the unsubscribe-fn arriving after cleanup has run.
            return new Promise((resolve, reject) => {
              resolveSubscribe = resolve;
              rejectSubscribe = reject;
            });
          }) as Mock,
        },
      },
      query: {
        system: {
          events: { at: mockEventsAt },
        },
      },
    } as unknown as ApiPromise;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // Bug 1
  it('invokes a late-arriving unsubscribe fn when cleanup() ran first', async () => {
    const emitter = new EventEmitter();
    const callback = jest.fn();

    subscribeToNewAggregationReceipts(api, callback, undefined, emitter).catch(
      () => {},
    );

    // Simulate the user manually unsubscribing before subscribeFinalizedHeads
    // has finished its handshake with the node.
    unsubscribe(emitter);

    // Now the polkadot subscribe handshake completes, late.
    resolveSubscribe(mockApiUnsubscribe);
    await new Promise((resolve) => setImmediate(resolve));

    // The unsubscribe fn must have been invoked, NOT silently captured into
    // an orphaned closure.
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
  });

  // Bug 5
  it('cleans up multiple subscriptions sharing the same emitter', async () => {
    const emitter = new EventEmitter();
    const callbackA = jest.fn();
    const callbackB = jest.fn();

    const a = subscribeToNewAggregationReceipts(
      api,
      callbackA,
      undefined,
      emitter,
    );
    const b = subscribeToNewAggregationReceipts(
      api,
      callbackB,
      undefined,
      emitter,
    );

    // Both subscriptions share ONE underlying finalized-heads subscription.
    expect(api.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalledTimes(1);

    resolveSubscribe(mockApiUnsubscribe);
    await new Promise((resolve) => setImmediate(resolve));

    unsubscribe(emitter);

    // Released once, when the last subscriber leaves; both waiters settle.
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
    await expect(a).rejects.toThrow(/Unsubscribed before/);
    await expect(b).rejects.toThrow(/Unsubscribed before/);
  });

  // Bug 6
  it('queries events via api.query.system.events.at, not api.at(...)', async () => {
    const emitter = new EventEmitter();
    const callback = jest.fn();
    type FinalizedCb = (header: any) => Promise<void> | void;
    const captured: { cb: FinalizedCb | null } = { cb: null };

    (
      api.rpc.chain.subscribeFinalizedHeads as unknown as jest.Mock
    ).mockImplementation(async (...args: unknown[]) => {
      captured.cb = args[0] as FinalizedCb;
      return mockApiUnsubscribe;
    });

    // api.at must NOT be relied on — assert the path directly by leaving it
    // unset on the mock and asserting events.at was called instead.
    expect((api as any).at).toBeUndefined();

    subscribeToNewAggregationReceipts(api, callback, undefined, emitter).catch(
      () => {},
    );
    await new Promise((resolve) => setImmediate(resolve));
    if (!captured.cb) throw new Error('Callback not captured');
    await captured.cb({ hash: { toHex: () => '0xabc' } });

    expect(mockEventsAt).toHaveBeenCalledWith('0xabc');
  });
});

describe('subscribeToNewAggregationReceipts — shared emitter and feed', () => {
  type FinalizedCb = (header: any) => Promise<void> | void;
  let api: ApiPromise;
  let mockApiUnsubscribe: jest.Mock<() => void>;
  let mockEventsAt: jest.Mock<(blockHash: any) => Promise<any>>;
  let finalizedHeadsCallback: FinalizedCb | null;

  const header = (hash: string) => ({ hash: { toHex: () => hash } });

  beforeEach(() => {
    jest.useRealTimers();
    mockApiUnsubscribe = jest.fn();
    finalizedHeadsCallback = null;
    mockEventsAt = jest
      .fn<(blockHash: any) => Promise<any>>()
      .mockImplementation(async () => []);

    api = {
      rpc: {
        chain: {
          subscribeFinalizedHeads: jest.fn(async (cb: FinalizedCb) => {
            finalizedHeadsCallback = cb;
            return mockApiUnsubscribe;
          }) as Mock,
        },
      },
      query: { system: { events: { at: mockEventsAt } } },
    } as unknown as ApiPromise;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a timed-out wait leaves sibling waits and consumer listeners intact', async () => {
    jest.useFakeTimers();
    const emitter = new EventEmitter();
    const consumerListener = jest.fn();
    emitter.on(ZkVerifyEvents.NewAggregationReceipt, consumerListener);

    const shortWait = subscribeToNewAggregationReceipts(
      api,
      jest.fn(),
      { domainId: 1, aggregationId: 10, timeout: 10 },
      emitter,
    );
    const siblingCallback = jest.fn();
    const longWait = subscribeToNewAggregationReceipts(
      api,
      siblingCallback,
      { domainId: 1, aggregationId: 11, timeout: 10_000 },
      emitter,
    );
    await Promise.resolve();

    jest.advanceTimersByTime(10);
    await expect(shortWait).rejects.toThrow(/Timeout exceeded/);

    // The consumer's own listener survived, and the shared feed is still open
    // because the sibling still needs it.
    expect(emitter.listenerCount(ZkVerifyEvents.NewAggregationReceipt)).toBe(1);
    expect(mockApiUnsubscribe).not.toHaveBeenCalled();

    // The sibling still receives and resolves on its own receipt.
    mockEventsAt.mockImplementation(async () => [
      createMockEventRecord('aggregate', 'NewAggregationReceipt', [
        '1',
        '11',
        '0xB',
      ]),
    ]);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');
    await finalizedHeadsCallback(header('0xblock'));

    await expect(longWait).resolves.toBe(emitter);
    expect(siblingCallback).toHaveBeenCalledTimes(1);
    expect(consumerListener).toHaveBeenCalledTimes(1);
    // Last subscriber gone: the underlying subscription is released once.
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('shares one finalized-heads subscription and one events query per block across concurrent waits', async () => {
    const emitter = new EventEmitter();
    const waits = [10, 11, 12].map((aggregationId) =>
      subscribeToNewAggregationReceipts(
        api,
        jest.fn(),
        { domainId: 1, aggregationId, timeout: 10_000 },
        emitter,
      ),
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(api.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalledTimes(1);

    mockEventsAt.mockImplementation(async () =>
      ['10', '11', '12'].map((id) =>
        createMockEventRecord('aggregate', 'NewAggregationReceipt', [
          '1',
          id,
          '0x' + id,
        ]),
      ),
    );
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');
    await finalizedHeadsCallback(header('0xblock'));

    expect(mockEventsAt).toHaveBeenCalledTimes(1);
    await expect(Promise.all(waits)).resolves.toHaveLength(3);
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);

    // A later subscriber opens a fresh subscription.
    subscribeToNewAggregationReceipts(api, jest.fn(), undefined, emitter).catch(
      () => {},
    );
    expect(api.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalledTimes(2);
    unsubscribe(emitter);
  });

  it('reports an events query failure through the promise, not as an unhandled rejection, and does not require an error listener', async () => {
    const emitter = new EventEmitter();
    const wait = subscribeToNewAggregationReceipts(
      api,
      jest.fn(),
      { domainId: 1, aggregationId: 10, timeout: 10_000 },
      emitter,
    );
    await new Promise((resolve) => setImmediate(resolve));

    mockEventsAt.mockImplementation(async () => {
      throw new Error('rpc down');
    });
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');
    // No 'error' listener is attached: emitting must not throw here.
    await expect(
      finalizedHeadsCallback(header('0xblock')),
    ).resolves.toBeUndefined();

    await expect(wait).rejects.toThrow('rpc down');
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('emits ErrorEvent only when a listener is attached', async () => {
    const emitter = new EventEmitter();
    const errors: unknown[] = [];
    emitter.on(ZkVerifyEvents.ErrorEvent, (e) => errors.push(e));

    const wait = subscribeToNewAggregationReceipts(
      api,
      jest.fn(),
      undefined,
      emitter,
    );
    await new Promise((resolve) => setImmediate(resolve));

    mockEventsAt.mockImplementation(async () => {
      throw new Error('rpc down');
    });
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');
    await finalizedHeadsCallback(header('0xblock'));

    await expect(wait).rejects.toThrow('rpc down');
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('rpc down');
  });

  it('rejects a pending wait when the consumer unsubscribes instead of hanging it', async () => {
    const emitter = new EventEmitter();
    const wait = subscribeToNewAggregationReceipts(
      api,
      jest.fn(),
      { domainId: 1, aggregationId: 10, timeout: 10_000 },
      emitter,
    );
    await new Promise((resolve) => setImmediate(resolve));

    unsubscribe(emitter);

    await expect(wait).rejects.toThrow(/Unsubscribed before/);
    expect(mockApiUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
