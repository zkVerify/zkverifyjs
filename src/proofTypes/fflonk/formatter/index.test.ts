import { describe, it, expect } from '@jest/globals';
import { formatProof, formatPubs, formatVk, to32ByteHex } from './index.js';
import { FflonkProof } from '../types.js';

const BN254_FQ =
  0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const BN254_FR =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

const point = ['1', '2', '1'];
const proof: FflonkProof = {
  polynomials: { C1: point, C2: point, W1: point, W2: point },
  evaluations: {
    ql: '1',
    qr: '2',
    qm: '3',
    qo: '4',
    qc: '5',
    s1: '6',
    s2: '7',
    s3: '8',
    a: '9',
    b: '10',
    c: '11',
    z: '12',
    zw: '13',
    t1w: '14',
    t2w: '15',
    inv: '16',
  },
} as unknown as FflonkProof;

describe('fflonk formatter', () => {
  it('encodes a well-formed proof as 24 big-endian 32-byte words', () => {
    const hex = formatProof(proof);
    expect(hex).toMatch(/^0x[0-9a-f]{1536}$/);
    expect(hex.slice(2, 66)).toBe('0'.repeat(63) + '1');
  });

  it('to32ByteHex rejects negative and non-canonical values', () => {
    expect(to32ByteHex('5', BN254_FR, 'x')).toBe('0'.repeat(63) + '5');
    expect(() => to32ByteHex('-1', BN254_FR, 'x')).toThrow(/not a canonical/);
    expect(() => to32ByteHex(BN254_FR.toString(), BN254_FR, 'x')).toThrow(
      /not a canonical/,
    );
    expect(() => to32ByteHex('1.5', BN254_FR, 'x')).toThrow();
  });

  it('rejects a proof with a negative or out-of-field coordinate', () => {
    const negative = {
      ...proof,
      polynomials: { ...proof.polynomials, C1: ['-1', '2', '1'] },
    } as FflonkProof;
    expect(() => formatProof(negative)).toThrow(/G1 coordinate/);

    const oversized = {
      ...proof,
      evaluations: { ...proof.evaluations, inv: BN254_FR.toString() },
    } as FflonkProof;
    expect(() => formatProof(oversized)).toThrow(/Evaluation/);

    const coordinateInFr = {
      ...proof,
      polynomials: {
        ...proof.polynomials,
        W2: [(BN254_FQ - 1n).toString(), '2', '1'],
      },
    } as FflonkProof;
    expect(formatProof(coordinateInFr)).toMatch(/^0x[0-9a-f]{1536}$/);
  });

  it('formats the first public signal and rejects malformed input', () => {
    expect(formatPubs(['3'])).toBe('0x' + '0'.repeat(63) + '3');
    expect(() => formatPubs([])).toThrow(/non-empty array/);
    expect(() => formatPubs(['1.5'])).toThrow();
    expect(() => formatPubs(['-3'])).toThrow(/not a canonical/);
    expect(() => formatPubs([BN254_FR.toString()])).toThrow(/not a canonical/);
    expect(() => formatPubs('3' as unknown as string[])).toThrow(
      /non-empty array/,
    );
  });

  it('formatVk parses a JSON string', () => {
    const vk = formatVk(JSON.stringify({ power: 5, X_2: ['1'], C0: ['2'] }));
    expect(vk.power).toBe(5);
    expect(vk.x2).toEqual(['1']);
    expect(vk.c0).toEqual(['2']);
  });
});
