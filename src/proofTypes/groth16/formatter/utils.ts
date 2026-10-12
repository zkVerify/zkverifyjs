import { CurveType } from '../../../enums.js';

const DECIMAL_RE = /^[0-9]+$/;
const HEX_RE = /^0x[0-9a-fA-F]+$/;

/**
 * Recursively converts numeric strings and hexadecimal strings in an object, array, or string
 * to `bigint`. Handles nested arrays and objects. Non-string scalars (number, bigint, boolean,
 * null, undefined) pass through unchanged.
 */
export const unstringifyBigInts = (o: unknown): unknown => {
  if (typeof o === 'string') {
    if (o.length > 1 && o[0] === '0' && o[1] === 'x') {
      return HEX_RE.test(o) ? BigInt(o) : o;
    }
    return DECIMAL_RE.test(o) ? BigInt(o) : o;
  }
  if (Array.isArray(o)) return o.map(unstringifyBigInts);
  if (typeof o === 'object' && o !== null) {
    const result: Record<string, unknown> = {};
    for (const key in o) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        // Plain assignment to a key named `__proto__` triggers the prototype setter
        // rather than creating an own property, letting untrusted JSON reshape this
        // object's prototype chain. defineProperty always creates an own property.
        Object.defineProperty(result, key, {
          value: unstringifyBigInts((o as Record<string, unknown>)[key]),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    return result;
  }
  return o;
};

/** Base-field (coordinate) and scalar-field (public input) moduli per curve. */
const FIELD_MODULI: Record<string, { fq: bigint; fr: bigint }> = {
  bn254: {
    fq: 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n,
    fr: 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n,
  },
  Bls12_381: {
    fq: 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaabn,
    fr: 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n,
  },
};

const curveForEndianess = (endianess: 'LE' | 'BE'): string =>
  endianess === 'LE' ? 'bn254' : 'Bls12_381';

/**
 * Asserts that `value` is a canonical element of the field with the given modulus.
 *
 * @throws {Error} If `value` is negative or not below `modulus`.
 */
export const requireCanonical = (
  value: bigint,
  modulus: bigint,
  what: string,
): bigint => {
  if (value < 0n || value >= modulus) {
    throw new Error(`${what} is not a canonical field element: ${value}`);
  }
  return value;
};

/**
 * Determines endianess based on the curve type.
 */
export const getEndianess = (curve: string): 'LE' | 'BE' => {
  return curve.toLowerCase() === 'bn254' ? 'LE' : 'BE';
};

/**
 * Extracts and normalizes curve type.
 */
export const extractCurve = (curve: CurveType): string => {
  if (curve === CurveType.bn128 || curve === CurveType.bn254) return 'bn254';
  if (curve === CurveType.bls12381) return 'Bls12_381';
  throw new Error(`Unsupported curve: ${curve}`);
};

/**
 * Converts bigint to a fixed-width hexadecimal string based on endianess.
 *
 * @throws {Error} If `value` is negative, or does not fit within `length` bytes.
 */
export const toHex = (
  value: bigint,
  length: number,
  endianess: 'LE' | 'BE',
): string => {
  if (value < 0n) {
    throw new Error(
      `Cannot encode negative value as a field element: ${value}`,
    );
  }

  const digits = value.toString(16);

  // `padStart` only ever pads, never truncates, so an out-of-range value would
  // otherwise pass through silently. For the little-endian path the resulting
  // odd-length string is then byte-reversed by a 1-or-2 character split, which
  // leaves a trailing single character and misaligns every byte of the output —
  // a silently corrupt encoding rather than an error.
  if (digits.length > length * 2) {
    throw new Error(
      `Value does not fit in ${length} bytes ` +
        `(requires ${Math.ceil(digits.length / 2)}): ${value}`,
    );
  }

  const hex = digits.padStart(length * 2, '0');

  if (endianess === 'BE') {
    return `0x${hex}`;
  }

  // Width is now guaranteed even, so a strict 2-character split is safe.
  const reversed = (hex.match(/.{2}/g) ?? []).reverse().join('');

  return `0x${reversed}`;
};

/**
 * Formats a G1 point based on endianess and curve type.
 */
export const formatG1Point = (
  point: string[],
  endianess: 'LE' | 'BE',
): string => {
  const { fq } = FIELD_MODULI[curveForEndianess(endianess)];
  const x = requireCanonical(BigInt(point[0]), fq, 'G1 x coordinate');
  const y = requireCanonical(BigInt(point[1]), fq, 'G1 y coordinate');
  return (
    toHex(x, endianess === 'LE' ? 32 : 48, endianess) +
    toHex(y, endianess === 'LE' ? 32 : 48, endianess).slice(2)
  );
};

/**
 * Formats a G2 point based on endianess and curve type.
 */
export const formatG2Point = (
  point: string[][],
  endianess: 'LE' | 'BE',
  curve: string,
): string => {
  const [x1, x2, y1, y2] = [
    BigInt(point[0][0]),
    BigInt(point[0][1]),
    BigInt(point[1][0]),
    BigInt(point[1][1]),
  ];

  const formatX =
    curve === 'Bls12_381'
      ? [x2.toString(), x1.toString()]
      : [x1.toString(), x2.toString()];

  const formatY =
    curve === 'Bls12_381'
      ? [y2.toString(), y1.toString()]
      : [y1.toString(), y2.toString()];

  return (
    formatG1Point(formatX, endianess) +
    formatG1Point(formatY, endianess).slice(2)
  );
};

/**
 * Formats a scalar as little-endian hexadecimal string.
 *
 * @param scalar - Decimal or hex string.
 * @param curve - Normalized curve name; when given, the value must be a canonical
 *   element of that curve's scalar field.
 */
export const formatScalar = (scalar: string, curve?: string): string => {
  const value = BigInt(scalar);
  const moduli = curve ? FIELD_MODULI[curve] : undefined;
  if (moduli) {
    requireCanonical(value, moduli.fr, 'Public signal');
  }
  return toHex(value, 32, 'LE');
};

/**
 * Formats an array of public signals.
 *
 * @param {string[]} pubs - Array of public signals.
 * @param {string} [curve] - Normalized curve name for the scalar-field check.
 * @returns {string[]} - Formatted public signals.
 */
export const formatPublicSignals = (
  pubs: string[],
  curve?: string,
): string[] => {
  if (!Array.isArray(pubs) || pubs.some((p) => typeof p !== 'string')) {
    throw new Error(
      'Invalid public signals format: Expected an array of strings.',
    );
  }
  return pubs.map((p) => formatScalar(p, curve));
};
