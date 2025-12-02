import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { EventEmitter } from 'events';
import { subscribeToNewAggregationReceipts, unsubscribe } from './index';
import { ZkVerifyEvents } from '../../enums';
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
  let mockApiAtInstance: {
    query: { system: { events: jest.Mock<() => Promise<any>> } };
  };

  beforeEach(() => {
    jest.useRealTimers();
    mockApiUnsubscribe = jest.fn();

    mockHeader = {
      hash: { toHex: () => '0xmockedhash' },
      number: { toNumber: () => 123, toBigInt: () => BigInt(123) },
    };

    mockApiAtInstance = {
      query: {
        system: {
          events: jest
            .fn<() => Promise<any>>()
            .mockImplementation(async () => Promise.resolve([] as any)),
        },
      },
    };

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
      at: jest.fn().mockImplementation(async (blockHash: any) => {
        return Promise.resolve(mockApiAtInstance);
      }),
    } as unknown as ApiPromise;

    callback = jest.fn();
    emitter = new EventEmitter();
    finalizedHeadsCallback = null;
    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([] as any),
    );
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

    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([mockEvent]),
    );
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
    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([]),
    );
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
    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
    expect(emitter.eventNames().length).toBe(0);
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
      (err) => {},
    );

    await new Promise((resolve) => setImmediate(resolve));
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');

    mockApiAtInstance.query.system.events.mockImplementation(async () =>
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
    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([mockEvent3]),
    );
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
    ).catch((err) => {});

    await new Promise((resolve) => setImmediate(resolve));
    expect(finalizedHeadsCallback).toBeInstanceOf(Function);
    if (!finalizedHeadsCallback) throw new Error('Callback not captured');

    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([mockEvent1]),
    );
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
    mockApiAtInstance.query.system.events.mockImplementation(async () =>
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
    mockApiAtInstance.query.system.events.mockImplementation(async () =>
      Promise.resolve([mockEvent2]),
    );
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
