import fs from 'fs';
import path from 'path';
import { ProofType } from '../../../../config/index.js';
import { CurveType, Library } from '../../../../enums.js';
import { formatPubs, formatVk } from './index.js';

const hex = (bytes: number) => '0x' + '11'.repeat(bytes);

const options = (curve: CurveType) => ({
  proofType: ProofType.groth16,
  config: { library: Library.arkworks, curve },
});

const vk = (g1: number, inputs = 2) => ({
  curve: 'ignored',
  alpha_g1: hex(g1),
  beta_g2: hex(2 * g1),
  gamma_g2: hex(2 * g1),
  delta_g2: hex(2 * g1),
  gamma_abc_g1: Array.from({ length: inputs }, () => hex(g1)),
});

describe('arkworks formatter', () => {
  it.each([CurveType.bn128, CurveType.bn254, CurveType.bls12381])(
    'accepts the %s fixture',
    (curve) => {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            `../../../../../tests/common/data/groth16_arkworks_${curve}.json`,
          ),
          'utf8',
        ),
      );
      expect(() => formatVk(data.vk, options(curve))).not.toThrow();
      expect(formatPubs(data.publicSignals)).toEqual(data.publicSignals);
    },
  );

  it.each([
    [CurveType.bn254, 64],
    [CurveType.bls12381, 96],
  ])('accepts exact %s VK point sizes', (curve, g1) => {
    expect(formatVk(vk(g1), options(curve)).curve).not.toBe('ignored');
  });

  it('rejects a VK point with trailing bytes', () => {
    const bad = { ...vk(64), beta_g2: hex(129) };
    expect(() => formatVk(bad, options(CurveType.bn254))).toThrow(
      'Arkworks VK beta_g2 must be exactly 128 bytes, got 129.',
    );
  });

  it('rejects bn254-sized points on bls12381', () => {
    expect(() => formatVk(vk(64), options(CurveType.bls12381))).toThrow(
      'Arkworks VK alpha_g1 must be exactly 96 bytes',
    );
  });

  it('rejects a short gamma_abc_g1 point', () => {
    const bad = vk(64);
    bad.gamma_abc_g1[1] = hex(63);
    expect(() => formatVk(bad, options(CurveType.bn254))).toThrow(
      'gamma_abc_g1[1] must be exactly 64 bytes',
    );
  });

  it('rejects more than 65 gamma_abc_g1 points', () => {
    expect(() => formatVk(vk(64, 66), options(CurveType.bn254))).toThrow(
      'at most 65 points',
    );
    expect(() => formatVk(vk(64, 65), options(CurveType.bn254))).not.toThrow();
  });

  it('rejects non-hex VK points', () => {
    const bad = { ...vk(64), alpha_g1: 'zz' };
    expect(() => formatVk(bad, options(CurveType.bn254))).toThrow(
      'Arkworks VK alpha_g1 must be 0x-prefixed hex.',
    );
  });

  it('rejects public inputs that are not exactly 32 bytes', () => {
    expect(() => formatPubs([hex(32), hex(33)])).toThrow(
      'Arkworks public input [1] must be exactly 32 bytes, got 33.',
    );
  });

  it('rejects more than 64 public inputs', () => {
    expect(() => formatPubs(Array(65).fill(hex(32)))).toThrow('at most 64');
  });
});
