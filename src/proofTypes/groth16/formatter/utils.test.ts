import {
  formatG1Point,
  formatG2Point,
  formatPublicSignals,
  formatScalar,
  requireCanonical,
  toHex,
  unstringifyBigInts,
} from './utils.js';

const BN254_FQ =
  0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const BN254_FR =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const BLS12_381_FQ =
  0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaabn;
const BLS12_381_FR =
  0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

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
        /not a canonical field element/,
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

describe('canonical field-element checks', () => {
  it('requireCanonical accepts [0, modulus) and rejects the rest', () => {
    expect(requireCanonical(0n, BN254_FR, 'x')).toBe(0n);
    expect(requireCanonical(BN254_FR - 1n, BN254_FR, 'x')).toBe(BN254_FR - 1n);
    expect(() => requireCanonical(BN254_FR, BN254_FR, 'x')).toThrow(
      /not a canonical field element/,
    );
    expect(() => requireCanonical(-1n, BN254_FR, 'x')).toThrow(
      /not a canonical field element/,
    );
  });

  it('rejects G1 coordinates at or above the base-field modulus', () => {
    expect(() => formatG1Point([BN254_FQ.toString(), '1'], 'LE')).toThrow(
      /G1 x coordinate is not a canonical field element/,
    );
    expect(() => formatG1Point(['1', BLS12_381_FQ.toString()], 'BE')).toThrow(
      /G1 y coordinate is not a canonical field element/,
    );
    // Fits the byte width (width check alone would pass) but exceeds the modulus.
    expect(() =>
      formatG1Point([(BN254_FQ + 1n).toString(), '1'], 'LE'),
    ).toThrow(/not a canonical/);
    // A canonical value still encodes.
    expect(formatG1Point([(BN254_FQ - 1n).toString(), '1'], 'LE')).toMatch(
      /^0x[0-9a-f]{128}$/,
    );
  });

  it('rejects G2 coordinates at or above the base-field modulus', () => {
    expect(() =>
      formatG2Point(
        [
          ['1', BN254_FQ.toString()],
          ['1', '1'],
        ],
        'LE',
        'bn254',
      ),
    ).toThrow(/not a canonical field element/);
  });

  it('checks public signals against the scalar field of the given curve', () => {
    expect(() => formatScalar(BN254_FR.toString(), 'bn254')).toThrow(
      /Public signal is not a canonical field element/,
    );
    expect(() => formatScalar(BLS12_381_FR.toString(), 'Bls12_381')).toThrow(
      /Public signal is not a canonical field element/,
    );
    expect(formatScalar((BN254_FR - 1n).toString(), 'bn254')).toMatch(
      /^0x[0-9a-f]{64}$/,
    );
    expect(() =>
      formatPublicSignals([(BLS12_381_FR + 5n).toString()], 'Bls12_381'),
    ).toThrow(/not a canonical/);
    expect(formatPublicSignals(['7'], 'bn254')).toEqual([formatScalar('7')]);
  });
});
