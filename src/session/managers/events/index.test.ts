import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { EventManager } from './index';
import { ZkVerifyEvents } from '../../../enums';
import { ApiPromise } from '@polkadot/api';
import { ConnectionManager } from '../connection';
import { EventEmitter } from 'events';

type SystemEventsCb = (records: any[]) => void;

interface SystemEventsHandshake {
  resolve: (fn: () => void) => void;
  reject: (err: unknown) => void;
}

interface MockApi {
  api: ApiPromise;
  systemEventsCalls: number;
  callbacks: SystemEventsCb[];
  handshakes: SystemEventsHandshake[];
  emitBlockToCallback: (index: number, records: any[]) => void;
  emitBlockToLatest: (records: any[]) => void;
}

function makeMockApi(): MockApi {
  const callbacks: SystemEventsCb[] = [];
  const handshakes: SystemEventsHandshake[] = [];

  const systemEvents = jest.fn((cb: SystemEventsCb) => {
    callbacks.push(cb);
    return new Promise<() => void>((resolve, reject) => {
      handshakes.push({ resolve, reject });
    });
  });

  const api = {
    rpc: { chain: { subscribeFinalizedHeads: jest.fn() } },
    query: {
      system: {
        events: Object.assign(systemEvents, { at: jest.fn() }),
      },
    },
  } as unknown as ApiPromise;

  return {
    api,
    get systemEventsCalls() {
      return systemEvents.mock.calls.length;
    },
    callbacks,
    handshakes,
    emitBlockToCallback: (index, records) => callbacks[index]?.(records),
    emitBlockToLatest: (records) => callbacks[callbacks.length - 1]?.(records),
  };
}

function makeRecord(section: string, method: string, dataValues: string[]) {
  return {
    event: {
      section,
      method,
      data: {
        toHuman: () => dataValues,
        toString: () => dataValues.join(','),
      },
    },
    phase: { toJSON: () => ({ ApplyExtrinsic: 0 }), toString: () => '' },
  };
}

function makeAggregationReceiptRecord(
  domainId: string,
  aggregationId: string,
  receipt: string,
) {
  const data = [domainId, aggregationId, receipt].map((value) => ({
    toString: () => value,
  })) as any[];
  (data as any).toHuman = () => [domainId, aggregationId, receipt];

  return {
    event: {
      section: 'aggregate',
      method: 'NewAggregationReceipt',
      data,
    },
    phase: { toJSON: () => ({ ApplyExtrinsic: 0 }), toString: () => '' },
  };
}

describe('EventManager', () => {
  let mock: MockApi;
  let manager: EventManager;

  beforeEach(() => {
    mock = makeMockApi();
    const connectionManager = {
      api: mock.api,
    } as unknown as ConnectionManager;
    manager = new EventManager(connectionManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Bug 4
  it('subscribes to api.query.system.events ONCE regardless of how many runtime events are subscribed', () => {
    manager.subscribe();
    expect(mock.systemEventsCalls).toBe(1);
  });

  // Bug 4 (dispatch correctness — fan-out from a single underlying subscription)
  it('dispatches a single decoded EventRecord vector to multiple per-event listeners', () => {
    const proofVerified = jest.fn();
    const newProof = jest.fn();
    manager.subscribe([
      { event: ZkVerifyEvents.ProofVerified, callback: proofVerified },
      { event: ZkVerifyEvents.NewProof, callback: newProof },
    ]);

    mock.emitBlockToLatest([
      makeRecord('proof', 'ProofVerified', ['0xa']),
      makeRecord('aggregate', 'NewProof', ['1', '2']),
    ]);

    expect(proofVerified).toHaveBeenCalledTimes(1);
    expect(newProof).toHaveBeenCalledTimes(1);
  });

  // Bug 3
  it('is idempotent: calling subscribe() twice does not re-register listeners', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    manager.subscribe([{ event: ZkVerifyEvents.ProofVerified, callback: cb1 }]);
    manager.subscribe([{ event: ZkVerifyEvents.ProofVerified, callback: cb2 }]);

    mock.emitBlockToLatest([makeRecord('proof', 'ProofVerified', ['0xa'])]);

    // First subscription's callback fires; second is a no-op.
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    // And the underlying polkadot subscription is still single.
    expect(mock.systemEventsCalls).toBe(1);
  });

  // Bug 2
  it('invokes a late-arriving system.events unsubscribe fn when unsubscribe() ran first', async () => {
    manager.subscribe([{ event: ZkVerifyEvents.ProofVerified }]);

    const unsubFn = jest.fn();
    // Caller closes the manager before the subscribe-handshake Promise resolves.
    manager.unsubscribe();
    mock.handshakes[0].resolve(unsubFn);
    await new Promise((resolve) => setImmediate(resolve));

    expect(unsubFn).toHaveBeenCalledTimes(1);
  });

  // Bug 2 (happy path: unsubscribe fn invoked when manager closes after handshake)
  it('invokes the system.events unsubscribe fn on unsubscribe() (post-handshake)', async () => {
    manager.subscribe([{ event: ZkVerifyEvents.ProofVerified }]);

    const unsubFn = jest.fn();
    mock.handshakes[0].resolve(unsubFn);
    await new Promise((resolve) => setImmediate(resolve));

    manager.unsubscribe();
    expect(unsubFn).toHaveBeenCalledTimes(1);
  });

  // Subscribe-after-unsubscribe lifecycle: re-using a manager across cycles.
  // Verifies (a) a fresh polkadot subscription is opened, (b) the new sub
  // can dispatch events normally, and (c) the late-arriving unsubscribe fn
  // from the PRIOR cycle is invoked immediately (not orphaned, and not held
  // for the next cycle's unsubscribe).
  it('supports subscribe → unsubscribe → subscribe and invalidates the old cycle', async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    manager.subscribe([{ event: ZkVerifyEvents.ProofVerified, callback: cb1 }]);

    // First cycle: close before the handshake resolves.
    manager.unsubscribe();

    // Second cycle: open a fresh subscription.
    manager.subscribe([{ event: ZkVerifyEvents.NewProof, callback: cb2 }]);
    expect(mock.systemEventsCalls).toBe(2);

    // First cycle's handshake completes late.
    const oldUnsub = jest.fn();
    mock.handshakes[0].resolve(oldUnsub);
    await new Promise((resolve) => setImmediate(resolve));
    // Must be invoked immediately — generation mismatch detected.
    expect(oldUnsub).toHaveBeenCalledTimes(1);

    // Second cycle's handshake completes.
    const newUnsub = jest.fn();
    mock.handshakes[1].resolve(newUnsub);
    await new Promise((resolve) => setImmediate(resolve));
    // Must NOT be invoked yet — manager is still open in the new cycle.
    expect(newUnsub).not.toHaveBeenCalled();

    // The new cycle's subscription still receives and dispatches events.
    mock.emitBlockToCallback(1, [makeRecord('aggregate', 'NewProof', ['x'])]);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();

    // First cycle's polkadot callback ignores any stale records (defensive).
    mock.emitBlockToCallback(0, [
      makeRecord('proof', 'ProofVerified', ['stale']),
    ]);
    expect(cb1).not.toHaveBeenCalled();

    // Closing the new cycle invokes its unsubscribe fn.
    manager.unsubscribe();
    expect(newUnsub).toHaveBeenCalledTimes(1);
  });

  it('waitForAggregationReceipt resolves array payloads and releases its listener', async () => {
    const finalizedHeadsUnsub = jest.fn();
    let finalizedHeadCallback!: (header: any) => Promise<void> | void;

    (
      mock.api.rpc.chain.subscribeFinalizedHeads as unknown as jest.Mock
    ).mockImplementation(async (...args: unknown[]) => {
      const callback = args[0] as (header: any) => Promise<void>;
      finalizedHeadCallback = callback;
      return finalizedHeadsUnsub;
    });
    ((mock.api.query.system.events as any).at as jest.Mock).mockImplementation(
      async () => [makeAggregationReceiptRecord('7', '9', '0xreceipt')],
    );

    const receiptPromise = manager.waitForAggregationReceipt(7, 9, 1000);
    await new Promise((resolve) => setImmediate(resolve));
    await finalizedHeadCallback({ hash: { toHex: () => '0xblock' } });

    await expect(receiptPromise).resolves.toEqual({
      blockHash: '0xblock',
      domainId: 7,
      aggregationId: 9,
      receipt: '0xreceipt',
    });
    expect(finalizedHeadsUnsub).toHaveBeenCalledTimes(1);
    expect(
      ((manager as any).emitter as EventEmitter).listenerCount(
        ZkVerifyEvents.Unsubscribe,
      ),
    ).toBe(0);
  });
});
