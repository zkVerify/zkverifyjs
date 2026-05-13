import { ProofOptions, ProofType } from '../../config/index.js';
import {
  RuntimeVersion,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../enums.js';
import { RuntimeSpec } from '../../types.js';
import { validateProofTypeOptions } from './index.js';

const runtimeSpec = (specVersion: RuntimeVersion): RuntimeSpec => ({
  specName: 'zkverify',
  specVersion,
});

describe('validateProofTypeOptions', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('ultrahonk runtime gates', () => {
    it('requires variant from runtime version 1.3.0', () => {
      expect(() =>
        validateProofTypeOptions(
          { proofType: ProofType.ultrahonk },
          runtimeSpec(RuntimeVersion.V1_3_0),
        ),
      ).toThrow("requires a 'variant' option");
    });

    it('allows variant-only config before runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.ultrahonk,
            config: { variant: UltrahonkVariant.Plain },
          },
          runtimeSpec(RuntimeVersion.V1_5_0),
        ),
      ).not.toThrow();
    });

    it('rejects versioned config before runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.ultrahonk,
            config: {
              version: UltrahonkVersion.V3_0,
              variant: UltrahonkVariant.Plain,
            },
          },
          runtimeSpec(RuntimeVersion.V1_5_0),
        ),
      ).toThrow("does not support a 'version' option");
    });

    it('defaults missing version from runtime version 1.6.0', () => {
      const options = {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      };

      const result = validateProofTypeOptions(
        options,
        runtimeSpec(RuntimeVersion.V1_6_0),
      );

      expect(result.config).toEqual({
        version: UltrahonkVersion.V0_84,
        variant: UltrahonkVariant.Plain,
      });
      expect(options.config).toEqual({ variant: UltrahonkVariant.Plain });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Defaulting missing 'version'"),
      );
    });

    it('still requires variant from runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.ultrahonk,
          },
          runtimeSpec(RuntimeVersion.V1_6_0),
        ),
      ).toThrow("requires 'version' and 'variant' options");
    });

    it('allows versioned config from runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.ultrahonk,
            config: {
              version: UltrahonkVersion.V3_0,
              variant: UltrahonkVariant.Plain,
            },
          },
          runtimeSpec(RuntimeVersion.V1_6_0),
        ),
      ).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('tee runtime gates', () => {
    it('allows missing variant before runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          { proofType: ProofType.tee },
          runtimeSpec(RuntimeVersion.V1_5_0),
        ),
      ).not.toThrow();
    });

    it('rejects variant config before runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.tee,
            config: { variant: TeeVariant.Intel },
          },
          runtimeSpec(RuntimeVersion.V1_5_0),
        ),
      ).toThrow("does not support a 'variant' option");
    });

    it('defaults missing variant from runtime version 1.6.0', () => {
      const options: ProofOptions = { proofType: ProofType.tee };

      const result = validateProofTypeOptions(
        options,
        runtimeSpec(RuntimeVersion.V1_6_0),
      );

      expect(result.config).toEqual({ variant: TeeVariant.Intel });
      expect(options.config).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Defaulting missing 'variant'"),
      );
    });

    it('allows variant config from runtime version 1.6.0', () => {
      expect(() =>
        validateProofTypeOptions(
          {
            proofType: ProofType.tee,
            config: { variant: TeeVariant.Intel },
          },
          runtimeSpec(RuntimeVersion.V1_6_0),
        ),
      ).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
