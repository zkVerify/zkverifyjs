import { describe, it, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { emitError, safeSnippet } from './index.js';
import { ZkVerifyEvents } from '../../enums.js';

describe('safeSnippet', () => {
  it('truncates strings without serialising them', () => {
    expect(safeSnippet('abcdef', 3)).toBe('abc');
    expect(safeSnippet('abc', 10)).toBe('abc');
  });

  it('matches JSON.stringify for small values', () => {
    const value = {
      a: 1,
      b: 'two',
      c: [true, null, 3.5],
      d: { nested: 'x' },
      e: undefined,
      f: () => {},
    };
    expect(safeSnippet(value, 1000)).toBe(JSON.stringify(value));
    expect(safeSnippet([undefined, 1], 100)).toBe(
      JSON.stringify([undefined, 1]),
    );
    expect(safeSnippet(null, 100)).toBe('null');
    expect(safeSnippet(42, 100)).toBe('42');
    expect(safeSnippet(NaN, 100)).toBe('null');
  });

  it('renders bigint as a quoted decimal string', () => {
    expect(safeSnippet({ v: 10n ** 30n }, 100)).toBe(
      `{"v":"${(10n ** 30n).toString()}"}`,
    );
  });

  it('honours toJSON', () => {
    const date = new Date('2026-10-08T00:00:00.000Z');
    expect(safeSnippet({ date }, 100)).toBe(JSON.stringify({ date }));
    expect(safeSnippet({ toJSON: () => 'custom' }, 100)).toBe('"custom"');
  });

  it('never throws on circular input', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;
    expect(safeSnippet(cyclic, 100)).toBe(
      '{"name":"root","self":"[Circular]"}',
    );
  });

  it('stops walking once the budget is spent and never exceeds it', () => {
    let touched = 0;
    const huge = Array.from({ length: 100_000 }, (_, i) => ({
      get value() {
        touched += 1;
        return i;
      },
    }));

    const snippet = safeSnippet(huge, 50);

    expect(snippet).toHaveLength(50);
    expect(snippet).toBe(JSON.stringify(huge.slice(0, 10)).slice(0, 50));
    // Proportional to the snippet, not to the input.
    expect(touched).toBeLessThan(20);
  });

  it('falls back to a marker when a getter or toJSON throws', () => {
    const hostile = {
      get boom(): string {
        throw new Error('no');
      },
    };
    expect(safeSnippet(hostile, 100)).toBe('[unserializable value]');
  });

  it('stringifies top-level values JSON cannot represent', () => {
    expect(safeSnippet(undefined, 100)).toBe('undefined');
    expect(safeSnippet(Symbol('s'), 100)).toBe('Symbol(s)');
  });
});

describe('emitError', () => {
  it('delivers the error to an attached listener', () => {
    const emitter = new EventEmitter();
    const received: unknown[] = [];
    emitter.on(ZkVerifyEvents.ErrorEvent, (e) => received.push(e));
    const err = new Error('x');

    emitError(emitter, err);

    expect(received).toEqual([err]);
  });

  it('does not throw when nobody is listening', () => {
    const emitter = new EventEmitter();
    expect(() => emitError(emitter, new Error('x'))).not.toThrow();
    expect(() => emitError(emitter, 'not an Error')).not.toThrow();
  });
});
