import { RuntimeVersion } from '../enums.js';
import { getZkvTypes, legacyZkvTypes, v1_6_1ZkvTypes } from './index.js';

describe('getZkvTypes', () => {
  it('uses legacy type definitions before runtime version 1.6.1', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_5_0,
      }),
    ).toBe(legacyZkvTypes);
  });

  it('uses v1.6.1 type definitions from runtime version 1.6.1', () => {
    expect(
      getZkvTypes({
        specName: 'zkverify',
        specVersion: RuntimeVersion.V1_6_1,
      }),
    ).toBe(v1_6_1ZkvTypes);
  });
});
