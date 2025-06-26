import { ProofProcessor } from '../../types';
import { getProofProcessor } from '../../utils/helpers';
import { ProofType } from '../../config';
import { format, formatVk } from './index';
import { CurveType, Library } from '../../enums';

jest.mock('../../utils/helpers', () => ({
  getProofProcessor: jest.fn(),
  validateProofVersion: jest.fn(),
}));

const baseProofOptions = {
  proofType: ProofType.groth16,
  config: {
    library: Library.snarkjs,
    curve: CurveType.bls12381,
  },
};

let mockProcessor: ProofProcessor;

beforeEach(() => {
  mockProcessor = {
    formatProof: jest.fn().mockImplementation((proof, options, version) => {
      if (version) return `formattedProof-${version}`;
      return 'formattedProof';
    }),
    formatPubs: jest.fn().mockReturnValue('formattedPubs'),
    formatVk: jest.fn().mockReturnValue('formattedVk'),
  };
  (getProofProcessor as jest.Mock).mockReturnValue(mockProcessor);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('format', () => {
  const proofOptions = baseProofOptions;

  it('should throw an error if unsupported proofType is provided', () => {
    (getProofProcessor as jest.Mock).mockReturnValue(null);
    expect(() =>
      format(
        { ...proofOptions, proofType: 'unsupportedType' as any },
        'proof',
        'signals',
        'vk',
      ),
    ).toThrow('Unsupported proof type: unsupportedType');
  });

  it('should throw an error if proof, public signals, or verification key is null, undefined, or empty', () => {
    expect(() => format(proofOptions, null, 'signals', 'vk')).toThrow(
      'groth16: Proof is required and cannot be null, undefined, or an empty string.',
    );
    expect(() => format(proofOptions, 'proof', null, 'vk')).toThrow(
      'groth16: Public signals are required and cannot be null, undefined, or an empty string.',
    );
    expect(() => format(proofOptions, 'proof', 'signals', null)).toThrow(
      'groth16: Verification Key must be provided.',
    );
  });

  it('should throw a formatted error if formatting proof fails', () => {
    (mockProcessor.formatProof as jest.Mock).mockImplementation(() => {
      throw new Error('Proof formatting error');
    });
    expect(() => format(proofOptions, 'proof', 'signals', 'vk')).toThrow(
      'Failed to format groth16 proof: Proof formatting error. Proof snippet: "proof..."',
    );
  });

  it('should throw a formatted error if formatting public signals fails', () => {
    (mockProcessor.formatPubs as jest.Mock).mockImplementation(() => {
      throw new Error('Public signals formatting error');
    });
    expect(() => format(proofOptions, 'proof', 'signals', 'vk')).toThrow(
      'Failed to format groth16 public signals: Public signals formatting error. Public signals snippet: "signals..."',
    );
  });

  it('should throw a formatted error if formatting verification key fails', () => {
    (mockProcessor.formatVk as jest.Mock).mockImplementation(() => {
      throw new Error('Verification key formatting error');
    });
    expect(() => format(proofOptions, 'proof', 'signals', 'vk')).toThrow(
      'Failed to format groth16 verification key: Verification key formatting error. Verification key snippet: "vk..."',
    );
  });

  it('should return formatted values for non-registered verification key', () => {
    const result = format(proofOptions, 'proof', 'signals', 'vk', false);
    expect(result).toEqual({
      formattedProof: 'formattedProof',
      formattedPubs: 'formattedPubs',
      formattedVk: { Vk: 'formattedVk' },
    });
  });

  it('should return formatted values for registered verification key', () => {
    const result = format(proofOptions, 'proof', 'signals', 'vk', true);
    expect(result).toEqual({
      formattedProof: 'formattedProof',
      formattedPubs: 'formattedPubs',
      formattedVk: { Hash: 'vk' },
    });
  });

  it('should handle UltraPlonk proof and publicSignals from formatProof', () => {
    const ultraplonkOptions = {
      ...proofOptions,
      proofType: ProofType.ultraplonk,
    };
    (mockProcessor.formatProof as jest.Mock).mockImplementation(() => ({
      proof: 'ultraplonkFormattedProof',
      publicSignals: 'ultraplonkFormattedPubs',
    }));
    const result = format(ultraplonkOptions, 'proof', 'signals', 'vk');
    expect(result.formattedProof).toBe('ultraplonkFormattedProof');
    expect(result.formattedPubs).toBe('ultraplonkFormattedPubs');
  });
});

describe('formatVk', () => {
  const proofOptions = baseProofOptions;

  it('should throw an error if unsupported proofType is provided', () => {
    (getProofProcessor as jest.Mock).mockReturnValue(null);
    expect(() =>
      formatVk({ ...proofOptions, proofType: 'unsupportedType' as any }, 'vk'),
    ).toThrow('Unsupported proof type: unsupportedType');
  });

  it('should throw an error if vk is null, undefined, or empty', () => {
    expect(() => formatVk(proofOptions, null)).toThrow(
      'groth16: Verification Key must be provided.',
    );
    expect(() => formatVk(proofOptions, '')).toThrow(
      'groth16: Verification Key must be provided.',
    );
  });

  it('should return formatted vk when valid', () => {
    const result = formatVk(proofOptions, 'vk');
    expect(result).toBe('formattedVk');
    expect(mockProcessor.formatVk).toHaveBeenCalledWith('vk', proofOptions);
  });

  it('should throw a formatted error if formatVk throws an error', () => {
    (mockProcessor.formatVk as jest.Mock).mockImplementation(() => {
      throw new Error('VK format fail');
    });
    expect(() => formatVk(proofOptions, 'badVK')).toThrow(
      'Failed to format groth16 verification key: VK format fail. Verification key snippet: "badVK..."',
    );
  });

  it('should handle object vk gracefully in error snippet', () => {
    (mockProcessor.formatVk as jest.Mock).mockImplementation(() => {
      throw new Error('Object vk error');
    });
    expect(() => formatVk(proofOptions, { nested: 'value' })).toThrow(
      'Failed to format groth16 verification key: Object vk error. Verification key snippet: "{"nested":"value"}..."',
    );
  });

  it('should handle non-Error throws correctly', () => {
    (mockProcessor.formatVk as jest.Mock).mockImplementation(() => {
      throw 'String error';
    });
    expect(() => formatVk(proofOptions, 'vk')).toThrow(
      'Failed to format groth16 verification key: Unknown error. Verification key snippet: "vk..."',
    );
  });
});
