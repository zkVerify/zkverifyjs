import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { hexToU8a } from '@polkadot/util';
import {
  createSubmitProofExtrinsic,
  createExtrinsicHex,
  createSubmittableExtrinsicFromHex,
} from './index';
import { ProofType } from '../../config';
import { FormattedProofData } from '../format/types';

jest.mock('../../utils/helpers', () => ({
  ...jest.requireActual('../../utils/helpers'),
  getProofPallet: (proofType: ProofType) => {
    return proofType === ProofType.groth16
      ? 'settlementGroth16Pallet'
      : undefined;
  },
}));

const mockTxMethod = {
  submitProof: jest.fn().mockReturnValue({
    toHex: jest.fn().mockReturnValue('0x1234'),
  }),
};

const mockApi = {
  tx: {
    settlementGroth16Pallet: mockTxMethod,
  },
  createType: jest.fn().mockReturnValue({ type: 'Extrinsic' }),
} as unknown as ApiPromise;

describe('extrinsic utilities', () => {
  const proofParams: FormattedProofData = {
    formattedVk: 'vk_data',
    formattedProof: 'proof_data',
    formattedPubs: 'pub_data',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubmitProofExtrinsic', () => {
    it('should create a submittable extrinsic with the given formatted proof parameters', () => {
      const extrinsic = createSubmitProofExtrinsic(
        mockApi,
        ProofType.groth16,
        proofParams,
      );

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        null,
      );
      expect(extrinsic.toHex()).toBe('0x1234');
    });

    it('should create a submittable extrinsic with a specific domainId', () => {
      const domainId = 42;
      const extrinsic = createSubmitProofExtrinsic(
        mockApi,
        ProofType.groth16,
        proofParams,
        domainId,
      );

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        domainId,
      );
      expect(extrinsic.toHex()).toBe('0x1234');
    });

    it('should handle undefined domainId as null', () => {
      const extrinsic = createSubmitProofExtrinsic(
        mockApi,
        ProofType.groth16,
        proofParams,
        undefined,
      );

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        null,
      );
      expect(extrinsic.toHex()).toBe('0x1234');
    });

    it('should throw an error if the proof type is unsupported', () => {
      expect(() => {
        createSubmitProofExtrinsic(mockApi, ProofType.ultraplonk, proofParams);
      }).toThrow('Unsupported proof type: ultraplonk');
    });

    it('should throw a formatted error if extrinsic creation fails', () => {
      mockTxMethod.submitProof.mockImplementationOnce(() => {
        throw new Error('Submission error');
      });

      expect(() =>
        createSubmitProofExtrinsic(mockApi, ProofType.groth16, proofParams),
      ).toThrow(
        'Error creating submittable extrinsic: groth16 Params: {\n  "formattedVk": "vk_data",\n  "formattedProof": "proof_data",\n  "formattedPubs": "pub_data"\n} Submission error',
      );
    });

    it('should handle non-Error types gracefully in formatError', () => {
      mockTxMethod.submitProof.mockImplementationOnce(() => {
        throw 'Unknown error';
      });

      expect(() =>
        createSubmitProofExtrinsic(mockApi, ProofType.groth16, proofParams),
      ).toThrow(
        'Error creating submittable extrinsic: groth16 Params: {\n  "formattedVk": "vk_data",\n  "formattedProof": "proof_data",\n  "formattedPubs": "pub_data"\n} An unknown error occurred',
      );
    });
  });

  describe('createExtrinsicHex', () => {
    it('should return the hex representation of a submittable extrinsic', () => {
      const hex = createExtrinsicHex(mockApi, ProofType.groth16, proofParams);

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        null,
      );
      expect(hex).toBe('0x1234');
    });

    it('should return hex representation with specific domainId', () => {
      const domainId = 42;
      const hex = createExtrinsicHex(
        mockApi,
        ProofType.groth16,
        proofParams,
        domainId,
      );

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        domainId,
      );
      expect(hex).toBe('0x1234');
    });

    it('should handle undefined domainId as null in hex generation', () => {
      const hex = createExtrinsicHex(
        mockApi,
        ProofType.groth16,
        proofParams,
        undefined,
      );

      expect(mockTxMethod.submitProof).toHaveBeenCalledWith(
        proofParams.formattedVk,
        proofParams.formattedProof,
        proofParams.formattedPubs,
        null,
      );
      expect(hex).toBe('0x1234');
    });

    it('should throw an error if proof type is unsupported in hex generation', () => {
      expect(() =>
        createExtrinsicHex(mockApi, ProofType.ultraplonk, proofParams),
      ).toThrow('Unsupported proof type: ultraplonk');
    });

    it('should throw a formatted error if hex generation fails', () => {
      mockTxMethod.submitProof.mockImplementationOnce(() => {
        throw new Error('Hex generation error');
      });

      expect(() =>
        createExtrinsicHex(mockApi, ProofType.groth16, proofParams),
      ).toThrow(
        'Error creating submittable extrinsic: groth16 Params: {\n  "formattedVk": "vk_data",\n  "formattedProof": "proof_data",\n  "formattedPubs": "pub_data"\n} Hex generation error',
      );
    });
  });

  describe('createExtrinsicFromHex', () => {
    it('should recreate an extrinsic from a hex string', () => {
      const hexString = '0x1234';

      const mockExtrinsic = {
        toHex: jest.fn().mockReturnValue('0xdeadbeef'),
        signAsync: jest.fn(),
      } as unknown as SubmittableExtrinsic<'promise'>;

      const mockApi = {
        tx: jest.fn().mockReturnValue(mockExtrinsic),
      } as unknown as ApiPromise;

      const recreated = createSubmittableExtrinsicFromHex(mockApi, hexString);

      expect(mockApi.tx).toHaveBeenCalledWith(hexString);
      expect(recreated).toBe(mockExtrinsic);
    });

    it('should throw a formatted error if reconstruction from hex fails', () => {
      const brokenApi = {
        tx: jest.fn(() => {
          throw new Error('Reconstruction error');
        }),
      } as unknown as ApiPromise;

      expect(() =>
        createSubmittableExtrinsicFromHex(brokenApi, '0x1234'),
      ).toThrow(
        /^Invalid extrinsic: Could not decode or reconstruct from the provided hex string/,
      );
    });

    it('should handle non-Error types gracefully in createExtrinsicFromHex', () => {
      const brokenApi = {
        tx: jest.fn(() => {
          throw 'Unknown reconstruction error';
        }),
      } as unknown as ApiPromise;

      expect(() =>
        createSubmittableExtrinsicFromHex(brokenApi, '0x1234'),
      ).toThrow(
        /^Invalid extrinsic: Could not decode or reconstruct from the provided hex string/,
      );
    });
  });
});
