import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ProofData } from '../../types';

export type VerifyInput =
  | { proofData: ProofData; domainId?: number | null; extrinsic?: never }
  | {
      extrinsic: SubmittableExtrinsic<'promise'>;
      domainId?: number | null;
      proofData?: never;
    };
