import { TypeRegistry } from '@polkadot/types';
import { RuntimeVersion } from '../enums.js';
import {
  getZkvTypes,
  legacyZkvTypes,
  ProofType,
  v1_6_1ZkvTypes,
  v1_6ZkvTypes,
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
});

describe('zkvRpc', () => {
  it.each([
    ['legacy', legacyZkvTypes],
    ['v1.6', v1_6ZkvTypes],
    ['v1.6.1', v1_6_1ZkvTypes],
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
