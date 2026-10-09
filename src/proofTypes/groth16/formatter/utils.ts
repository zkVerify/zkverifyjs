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
  const [x, y] = [BigInt(point[0]), BigInt(point[1])];
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
 */
export const formatScalar = (scalar: string): string =>
  toHex(BigInt(scalar), 32, 'LE');

/**
 * Formats an array of public signals.
 *
 * @param {string[]} pubs - Array of public signals.
 * @returns {string[]} - Formatted public signals.
 */
export const formatPublicSignals = (pubs: string[]): string[] => {
  if (!Array.isArray(pubs) || pubs.some((p) => typeof p !== 'string')) {
    throw new Error(
      'Invalid public signals format: Expected an array of strings.',
    );
  }
  return pubs.map(formatScalar);
};
