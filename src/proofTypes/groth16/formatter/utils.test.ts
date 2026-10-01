import {
  formatG1Point,
  formatPublicSignals,
  formatScalar,
  toHex,
  unstringifyBigInts,
} from './utils.js';

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

describe('toHex', () => {
  describe('in-range encoding', () => {
    it('encodes little-endian', () => {
      expect(toHex(1n, 32, 'LE')).toBe('0x' + '01' + '00'.repeat(31));
      expect(toHex(0n, 32, 'LE')).toBe('0x' + '00'.repeat(32));
      expect(toHex(2n ** 256n - 1n, 32, 'LE')).toBe('0x' + 'ff'.repeat(32));
    });

    it('encodes big-endian', () => {
      expect(toHex(1n, 48, 'BE')).toBe('0x' + '00'.repeat(47) + '01');
    });

    it('byte-reverses for little-endian', () => {
      expect(toHex(0x0102n, 2, 'LE')).toBe('0x0201');
    });

    it('produces a 32-byte scalar for a realistic field element', () => {
      const s =
        '21888242871839275222246405745257275088548364400416034343698204186575808495616';
      expect(formatScalar(s)).toBe(toHex(BigInt(s), 32, 'LE'));
      expect(formatScalar(s)).toHaveLength(66);
    });
  });

  describe('out-of-range rejection', () => {
    // Regression: `padStart` only pads, so an oversized value used to pass through
    // silently. For the little-endian path the odd-length hex was then byte-reversed
    // by a /.{1,2}/ split, leaving an orphan trailing character and misaligning every
    // byte — a corrupt encoding rather than an error.
    it('throws rather than silently corrupting an oversized value', () => {
      expect(() => toHex(2n ** 256n, 32, 'LE')).toThrow(
        /does not fit in 32 bytes/,
      );
      expect(() => toHex(2n ** 260n, 32, 'LE')).toThrow(
        /does not fit in 32 bytes/,
      );
    });

    it('throws on negative values', () => {
      expect(() => toHex(-1n, 32, 'LE')).toThrow(/negative/);
    });

    it('propagates the rejection through formatG1Point', () => {
      expect(() => formatG1Point([(2n ** 300n).toString(), '1'], 'LE')).toThrow(
        /does not fit/,
      );
    });
  });
});

describe('unstringifyBigInts prototype safety', () => {
  it('does not let a __proto__ key reshape the result prototype', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": "yes"}, "a": "1"}');
    const result = unstringifyBigInts(hostile) as Record<string, unknown>;

    // __proto__ must become an own property, not a prototype assignment.
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
      true,
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as { polluted?: unknown }).polluted).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(result.a).toBe(1n);
  });
});
