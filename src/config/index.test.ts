import { TypeRegistry } from '@polkadot/types';
import { RuntimeVersion } from '../enums.js';
import {
  getZkvTypes,
  getZkvTypesBundle,
  legacyZkvTypes,
  ProofType,
  v1_6_1ZkvTypes,
  v1_6ZkvTypes,
  v2_1ZkvTypes,
  zkvRpc,
} from './index.js';

describe('getZkvTypes', () => {
  it('uses legacy type definitions before runtime version 1.6.0', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_5_0,
      }),
    ).toBe(legacyZkvTypes);
  });

  it('uses v1.6 type definitions from runtime version 1.6.0', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_6_0,
      }),
    ).toBe(v1_6ZkvTypes);
  });

  it('uses v1.6.1 type definitions from runtime version 1.6.1', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_6_1,
      }),
    ).toBe(v1_6_1ZkvTypes);
  });

  it('uses v1.6.1 type definitions from runtime version 2.0.0', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V2_0_0,
      }),
    ).toBe(v1_6_1ZkvTypes);
  });

  it('uses v2.1 type definitions from runtime version 2.1.0', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V2_1_0,
      }),
    ).toBe(v2_1ZkvTypes);
  });

  it('encodes UltraHonk V5_0 verification keys at variant index 3', () => {
    const registry = new TypeRegistry();
    registry.register(v2_1ZkvTypes);

    const vk = registry.createType('UltraHonkVk', { V5_0: '0x01' });

    expect(vk.toU8a()[0]).toBe(3);
    expect(vk.toJSON()).toEqual({ v50: '0x01' });
  });
});

describe('getZkvTypesBundle', () => {
  const specTypes = (specVersion: number) => {
    const ranges = getZkvTypesBundle('zkv-runtime').spec!['zkv-runtime'].types!;
    const matches = ranges.filter(
      ({ minmax: [min, max] }) =>
        (min == null || specVersion >= min) &&
        (max == null || specVersion <= max),
    );
    expect(matches).toHaveLength(1);
    return matches[0].types;
  };

  it.each([
    [RuntimeVersion.V1_3_0, legacyZkvTypes],
    [RuntimeVersion.V1_5_0, legacyZkvTypes],
    [RuntimeVersion.V1_6_0, v1_6ZkvTypes],
    [RuntimeVersion.V1_6_1, v1_6_1ZkvTypes],
    [RuntimeVersion.V2_0_0, v1_6_1ZkvTypes],
    [RuntimeVersion.V2_1_0, v2_1ZkvTypes],
    // A future runtime (2.2.0) keeps the latest type set: the last range is open-ended.
    [2_002_000, v2_1ZkvTypes],
  ])(
    'selects the same types as getZkvTypes for spec %i',
    (specVersion, types) => {
      expect(specTypes(specVersion)).toBe(types);
      expect(getZkvTypes({ specName: 'zkv-runtime', specVersion })).toBe(types);
    },
  );

  it('keys the bundle by the given spec name', () => {
    expect(Object.keys(getZkvTypesBundle('tzkv-runtime').spec!)).toEqual([
      'tzkv-runtime',
    ]);
  });
});

describe('zkvRpc', () => {
  it.each([
    ['legacy', legacyZkvTypes],
    ['v1.6', v1_6ZkvTypes],
    ['v1.6.1', v1_6_1ZkvTypes],
    ['v2.1', v2_1ZkvTypes],
  ])(
    'declares only types constructable with the %s type bundle',
    (_label, bundle) => {
      const registry = new TypeRegistry();
      registry.register(bundle);

      for (const [section, methods] of Object.entries(zkvRpc)) {
        for (const [method, definition] of Object.entries(methods)) {
          for (const param of definition.params) {
            expect(() => registry.createType(param.type)).not.toThrow();
          }
          expect(() => registry.createType(definition.type)).not.toThrow();
          void section;
          void method;
        }
      }
    },
  );

  it('only declares vk_hash methods for known proof types', () => {
    const proofTypes = Object.values(ProofType) as string[];

    for (const method of Object.keys(zkvRpc.vk_hash)) {
      expect(proofTypes).toContain(method);
    }
  });

  it('does not declare a vk_hash method for tee (not exposed by the node)', () => {
    expect(Object.keys(zkvRpc.vk_hash)).not.toContain('tee');
  });
});
