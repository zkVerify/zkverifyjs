import { formatPublicSignals, unstringifyBigInts } from './utils.js';

describe('unstringifyBigInts', () => {
  it('converts decimal strings to bigint', () => {
    expect(unstringifyBigInts('123')).toBe(123n);
  });

  it('converts hex strings to bigint', () => {
    expect(unstringifyBigInts('0xff')).toBe(255n);
    expect(unstringifyBigInts('0xDEADBEEF')).toBe(0xdeadbeefn);
  });

  it('passes through already-numeric inputs unchanged', () => {
    expect(unstringifyBigInts(42)).toBe(42);
    expect(unstringifyBigInts(99n)).toBe(99n);
  });

  it('passes through null, undefined, and booleans', () => {
    expect(unstringifyBigInts(null)).toBeNull();
    expect(unstringifyBigInts(undefined)).toBeUndefined();
    expect(unstringifyBigInts(true)).toBe(true);
  });

  it('leaves non-numeric strings unchanged', () => {
    expect(unstringifyBigInts('')).toBe('');
    expect(unstringifyBigInts('hello')).toBe('hello');
    expect(unstringifyBigInts('0xGG')).toBe('0xGG');
    expect(unstringifyBigInts('12abc')).toBe('12abc');
  });

  it('recursively converts arrays', () => {
    expect(unstringifyBigInts(['1', '2', 'notnum'])).toEqual([
      1n,
      2n,
      'notnum',
    ]);
  });

  it('recursively converts nested objects', () => {
    const input = {
      a: '10',
      b: { c: '0x20', d: ['30', 'x'] },
    };
    expect(unstringifyBigInts(input)).toEqual({
      a: 10n,
      b: { c: 32n, d: [30n, 'x'] },
    });
  });

  it('does not run the hex regex when the string lacks a 0x prefix', () => {
    const hexSpy = jest.spyOn(RegExp.prototype, 'test');
    try {
      unstringifyBigInts('123456789');
      const calls = hexSpy.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThan(2);
    } finally {
      hexSpy.mockRestore();
    }
  });
});

describe('formatPublicSignals', () => {
  it('formats an array of numeric-string pubs to LE-hex scalars', () => {
    const result = formatPublicSignals(['1', '2']);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result[1]).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('returns an empty array for empty input', () => {
    expect(formatPublicSignals([])).toEqual([]);
  });

  it('throws when pubs is not an array', () => {
    expect(() =>
      formatPublicSignals('not-an-array' as unknown as string[]),
    ).toThrow('Invalid public signals format: Expected an array of strings.');
  });

  it('throws when pubs contains a non-string element (number)', () => {
    expect(() => formatPublicSignals([1, 2, 3] as unknown as string[])).toThrow(
      'Invalid public signals format: Expected an array of strings.',
    );
  });

  it('throws when pubs contains a null element', () => {
    expect(() =>
      formatPublicSignals(['1', null as unknown as string, '3']),
    ).toThrow('Invalid public signals format: Expected an array of strings.');
  });

  it('throws when pubs contains an object element', () => {
    expect(() =>
      formatPublicSignals(['1', { value: '2' } as unknown as string]),
    ).toThrow('Invalid public signals format: Expected an array of strings.');
  });
});
