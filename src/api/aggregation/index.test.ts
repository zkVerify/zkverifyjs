import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  subscribeToNewAggregationReceipts,
  unsubscribeFromNewAggregationReceipts,
} from './index';
import { ZkVerifyEvents } from '../../enums';
import { ApiPromise } from '@polkadot/api';

describe('subscribeToNewAggregationReceipts', () => {
  let api: ApiPromise;
  let callback: jest.Mock;

  beforeEach(() => {
    api = {
      query: {
        system: {
          events: jest.fn(),
        },
      },
    } as unknown as ApiPromise;

    callback = jest.fn();
  });

  it('should emit AggregationMissed event when aggregationId is lower than received and unsubscribe all listeners', async () => {
    const events = [
      {
        event: {
          section: 'aggregate',
          method: 'NewAggregationReceipt',
          data: ['1', '3', 'aggregationData'],
        },
      },
    ];

    const mockEvents = jest.fn().mockImplementation((cb: any) => {
      setTimeout(() => cb(events), 0);
      return Promise.resolve();
    });

    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback, {
      domainId: 1,
      aggregationId: 1,
    });
    const emitSpy = jest.spyOn(emitter, 'emit');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.AggregationMissed, {
      expectedId: 1,
      receivedId: 3,
      event: events[0].event,
    });

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });

  it('should emit AggregationBeforeExpected event when aggregationId is higher than received', async () => {
    const events = [
      {
        event: {
          section: 'aggregate',
          method: 'NewAggregationReceipt',
          data: ['1', '1', '0xreceipt'],
        },
      },
    ];

    const mockEvents = jest.fn().mockImplementation((cb: any) => {
      setTimeout(() => cb(events), 0);
      return Promise.resolve();
    });

    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback, {
      domainId: 1,
      aggregationId: 3,
    });
    const emitSpy = jest.spyOn(emitter, 'emit');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(emitSpy).toHaveBeenCalledWith(
      ZkVerifyEvents.AggregationBeforeExpected,
      {
        expectedId: 3,
        receivedId: 1,
        event: events[0].event,
      },
    );
  });

  it('should emit AggregationMatched event when aggregationId matches received', async () => {
    const events = [
      {
        event: {
          section: 'aggregate',
          method: 'NewAggregationReceipt',
          data: ['1', '2', '0xreceipt'],
        },
      },
    ];

    const mockEvents = jest.fn().mockImplementation((cb: any) => {
      setTimeout(() => cb(events), 0);
      return Promise.resolve();
    });

    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback, {
      domainId: 1,
      aggregationId: 2,
    });
    const emitSpy = jest.spyOn(emitter, 'emit');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callback).toHaveBeenCalledWith({
      domainId: 1,
      aggregationId: 2,
      receipt: '0xreceipt',
    });

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.AggregationMatched, {
      domainId: 1,
      aggregationId: 2,
      receipt: '0xreceipt',
    });

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });

  it('should call callback without aggregationId and not unsubscribe', async () => {
    const events = [
      {
        event: {
          section: 'aggregate',
          method: 'NewAggregationReceipt',
          data: ['1', '2', '0xaggregationReceipt'],
        },
      },
    ];

    const mockEvents = jest.fn().mockImplementation((cb: any) => {
      setTimeout(() => cb(events), 0);
      return Promise.resolve();
    });

    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback);
    const emitSpy = jest.spyOn(emitter, 'emit');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callback).toHaveBeenCalledWith({
      domainId: 1,
      aggregationId: 2,
      receipt: '0xaggregationReceipt',
    });

    expect(emitSpy).not.toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });

  it('should emit ErrorEvent on any error', async () => {
    const error = new Error('Some error occurred');

    const mockEvents = jest.fn().mockRejectedValue(error as never);
    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback);
    const emitSpy = jest.spyOn(emitter, 'emit');

    await new Promise<void>((resolve) => {
      emitter.on(ZkVerifyEvents.ErrorEvent, () => resolve());
    });

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.ErrorEvent, error);
  });

  it('should emit Unsubscribe event and remove all listeners when unsubscribe is triggered', async () => {
    const events = [
      {
        event: {
          section: 'aggregate',
          method: 'NewAggregationReceipt',
          data: ['1', '3', 'aggregationData'],
        },
      },
    ];

    const mockEvents = jest.fn().mockImplementation((cb: any) => {
      setTimeout(() => cb(events), 0);
      return Promise.resolve();
    });

    api.query.system.events = mockEvents as any;

    const emitter = subscribeToNewAggregationReceipts(api, callback, {
      domainId: 1,
      aggregationId: 1,
    });
    const emitSpy = jest.spyOn(emitter, 'emit');
    const removeListenersSpy = jest.spyOn(emitter, 'removeAllListeners');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.AggregationMissed, {
      expectedId: 1,
      receivedId: 3,
      event: events[0].event,
    });

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);

    expect(removeListenersSpy).toHaveBeenCalled();
  });

  it('unsubscribeFromNewAggregationReceipts should emit Unsubscribe event', async () => {
    const emitter = new EventEmitter();
    const emitSpy = jest.spyOn(emitter, 'emit');

    unsubscribeFromNewAggregationReceipts(emitter);

    expect(emitSpy).toHaveBeenCalledWith(ZkVerifyEvents.Unsubscribe);
  });

  it('should throw if aggregationId is provided without domainId', () => {
    expect(() => {
      subscribeToNewAggregationReceipts(api, callback, {
        aggregationId: 1,
      } as any);
    }).toThrow(
      'Cannot filter by aggregationId without also providing domainId.',
    );
  });
});
