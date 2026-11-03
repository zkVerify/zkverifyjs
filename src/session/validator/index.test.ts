import { ProofOptions, ProofType } from '../../config/index.js';
import {
  Risc0Version,
  RuntimeVersion,
  TeeVariant,
  UltrahonkVariant,
  UltrahonkVersion,
} from '../../enums.js';
import { RuntimeSpec } from '../../types.js';
import {
  rejectUnsupportedProofVersions,
  validateProofTypeOptions,
} from './index.js';

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

    it('defaults missing version to V0_84 on runtime version 1.6.0', () => {
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
        expect.stringContaining(`'${UltrahonkVersion.V0_84}'`),
      );
    });

    it('defaults missing version to Legacy on runtime version 1.6.1', () => {
      const options = {
        proofType: ProofType.ultrahonk,
        config: { variant: UltrahonkVariant.Plain },
      };

      const result = validateProofTypeOptions(
        options,
        runtimeSpec(RuntimeVersion.V1_6_1),
      );

      expect(result.config).toEqual({
        version: UltrahonkVersion.Legacy,
        variant: UltrahonkVariant.Plain,
      });
      expect(options.config).toEqual({ variant: UltrahonkVariant.Plain });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`'${UltrahonkVersion.Legacy}'`),
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

  describe('ultrahonk V5_0 runtime gate', () => {
    const v5Options: ProofOptions = {
      proofType: ProofType.ultrahonk,
      config: {
        version: UltrahonkVersion.V5_0,
        variant: UltrahonkVariant.ZK,
      },
    };

    it('rejects V5_0 before runtime version 2.1.0', () => {
      expect(() =>
        validateProofTypeOptions(v5Options, runtimeSpec(RuntimeVersion.V2_0_0)),
      ).toThrow('only available in runtime version 2.1.0 or later');
    });

    it('allows V5_0 from runtime version 2.1.0', () => {
      expect(
        validateProofTypeOptions(v5Options, runtimeSpec(RuntimeVersion.V2_1_0)),
      ).toEqual(v5Options);
    });

    it.each([RuntimeVersion.V2_0_0, RuntimeVersion.V2_1_0])(
      'keeps the Legacy default for Plain on runtime version %i',
      (specVersion) => {
        const result = validateProofTypeOptions(
          {
            proofType: ProofType.ultrahonk,
            config: { variant: UltrahonkVariant.Plain },
          },
          runtimeSpec(specVersion),
        );

        expect(result.config).toEqual({
          version: UltrahonkVersion.Legacy,
          variant: UltrahonkVariant.Plain,
        });
        expect(() =>
          rejectUnsupportedProofVersions(result, runtimeSpec(specVersion)),
        ).not.toThrow();
      },
    );

    it('rejects version-less ZK on runtime version 2.1.0, naming the Legacy default', () => {
      const result = validateProofTypeOptions(
        {
          proofType: ProofType.ultrahonk,
          config: { variant: UltrahonkVariant.ZK },
        },
        runtimeSpec(RuntimeVersion.V2_1_0),
      );

      expect(result.config).toEqual({
        version: UltrahonkVersion.Legacy,
        variant: UltrahonkVariant.ZK,
      });
      expect(() =>
        rejectUnsupportedProofVersions(
          result,
          runtimeSpec(RuntimeVersion.V2_1_0),
        ),
      ).toThrow(
        `Use version '${UltrahonkVersion.V5_0}' for ZK proofs. A missing 'version' defaults to '${UltrahonkVersion.Legacy}'.`,
      );
    });

    it('keeps the Legacy default on runtime version 2.0.0', () => {
      const result = validateProofTypeOptions(
        {
          proofType: ProofType.ultrahonk,
          config: { variant: UltrahonkVariant.Plain },
        },
        runtimeSpec(RuntimeVersion.V2_0_0),
      );

      expect(result.config).toEqual({
        version: UltrahonkVersion.Legacy,
        variant: UltrahonkVariant.Plain,
      });
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

describe('rejectUnsupportedProofVersions', () => {
  const ultrahonk = (
    version: UltrahonkVersion,
    variant: UltrahonkVariant,
  ): ProofOptions => ({
    proofType: ProofType.ultrahonk,
    config: { version, variant },
  });

  const risc0 = (version: Risc0Version): ProofOptions => ({
    proofType: ProofType.risc0,
    config: { version },
  });

  it.each([
    UltrahonkVersion.V0_84,
    UltrahonkVersion.V3_0,
    UltrahonkVersion.Legacy,
  ])('rejects ultrahonk %s ZK from runtime version 2.1.0', (version) => {
    expect(() =>
      rejectUnsupportedProofVersions(
        ultrahonk(version, UltrahonkVariant.ZK),
        runtimeSpec(RuntimeVersion.V2_1_0),
      ),
    ).toThrow(`Use version '${UltrahonkVersion.V5_0}' for ZK proofs`);
  });

  it.each([
    UltrahonkVersion.V0_84,
    UltrahonkVersion.V3_0,
    UltrahonkVersion.Legacy,
    UltrahonkVersion.V5_0,
  ])('allows ultrahonk %s Plain from runtime version 2.1.0', (version) => {
    expect(() =>
      rejectUnsupportedProofVersions(
        ultrahonk(version, UltrahonkVariant.Plain),
        runtimeSpec(RuntimeVersion.V2_1_0),
      ),
    ).not.toThrow();
  });

  it('allows ultrahonk V5_0 ZK from runtime version 2.1.0', () => {
    expect(() =>
      rejectUnsupportedProofVersions(
        ultrahonk(UltrahonkVersion.V5_0, UltrahonkVariant.ZK),
        runtimeSpec(RuntimeVersion.V2_1_0),
      ),
    ).not.toThrow();
  });

  it('allows ultrahonk V3_0 ZK before runtime version 2.1.0', () => {
    expect(() =>
      rejectUnsupportedProofVersions(
        ultrahonk(UltrahonkVersion.V3_0, UltrahonkVariant.ZK),
        runtimeSpec(RuntimeVersion.V2_0_0),
      ),
    ).not.toThrow();
  });

  it('rejects risc0 V2_1 from runtime version 2.1.0', () => {
    expect(() =>
      rejectUnsupportedProofVersions(
        risc0(Risc0Version.V2_1),
        runtimeSpec(RuntimeVersion.V2_1_0),
      ),
    ).toThrow(`Use '${Risc0Version.V2_2}' or later`);
  });

  it('allows risc0 V2_1 before runtime version 2.1.0', () => {
    expect(() =>
      rejectUnsupportedProofVersions(
        risc0(Risc0Version.V2_1),
        runtimeSpec(RuntimeVersion.V2_0_0),
      ),
    ).not.toThrow();
  });

  it('allows risc0 V2_2 from runtime version 2.1.0', () => {
    expect(() =>
      rejectUnsupportedProofVersions(
        risc0(Risc0Version.V2_2),
        runtimeSpec(RuntimeVersion.V2_1_0),
      ),
    ).not.toThrow();
  });
});
