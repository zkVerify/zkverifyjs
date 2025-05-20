import { ProofOptions } from '../../../config';
import { isUltraplonkConfig } from '../../../utils/helpers';

function getNumPublicInputs(options: ProofOptions): number {
  if (!isUltraplonkConfig(options)) {
    throw new Error(
      'Expected Ultraplonk config but received invalid configuration.',
    );
  }

  return options.config.numberOfPublicInputs;
}

export function formatProof(
  base64: string,
  options: ProofOptions,
): {
  proof: string;
  publicSignals: string[];
} {
  const numPublicInputs = getNumPublicInputs(options);
  const raw = Buffer.from(base64, 'base64');

  const inputByteLen = 32 * numPublicInputs;
  if (raw.length < inputByteLen) {
    throw new Error(
      `Proof too small: expected at least ${inputByteLen} bytes, got ${raw.length}`,
    );
  }

  const pubInputBytes = raw.slice(0, inputByteLen);
  const proofBody = raw.slice(inputByteLen);

  const bytesToHexFieldElement = (bytes: Uint8Array): string =>
    '0x' + Buffer.from(bytes).toString('hex');

  const publicSignals: string[] = [];
  for (let i = 0; i < numPublicInputs; i++) {
    const chunk = pubInputBytes.slice(i * 32, (i + 1) * 32);
    publicSignals.push(bytesToHexFieldElement(chunk));
  }

  return {
    proof: '0x' + Buffer.from(proofBody).toString('hex'),
    publicSignals,
  };
}

export function formatVk(base64: string): string {
  const COMMITMENT_LABELS_ORDERED = [
    'ID_1',
    'ID_2',
    'ID_3',
    'ID_4',
    'Q_1',
    'Q_2',
    'Q_3',
    'Q_4',
    'Q_ARITHMETIC',
    'Q_AUX',
    'Q_C',
    'Q_ELLIPTIC',
    'Q_M',
    'Q_SORT',
    'SIGMA_1',
    'SIGMA_2',
    'SIGMA_3',
    'SIGMA_4',
    'TABLE_1',
    'TABLE_2',
    'TABLE_3',
    'TABLE_4',
    'TABLE_TYPE',
  ] as const;

  type CommitmentLabel = (typeof COMMITMENT_LABELS_ORDERED)[number];
  const COMMITMENT_LABELS = new Set<CommitmentLabel>(COMMITMENT_LABELS_ORDERED);

  interface G1Point {
    x: bigint;
    y: bigint;
  }

  interface VerificationKey {
    circuitType: number;
    circuitSize: number;
    numPublicInputs: number;
    commitments: Record<CommitmentLabel, G1Point>;
    containsRecursiveProof: boolean;
    recursiveProofIndices: number;
  }

  const readU32 = (view: DataView, offset: number): [number, number] => {
    return [view.getUint32(offset, false), offset + 4];
  };

  const readBool = (view: DataView, offset: number): [boolean, number] => {
    const val = view.getUint8(offset);
    if (val !== 0 && val !== 1) throw new Error(`Invalid bool value: ${val}`);
    return [val === 1, offset + 1];
  };

  const bytesToBigIntBE = (bytes: Uint8Array): bigint => {
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
  };

  const readG1Point = (view: DataView, offset: number): [G1Point, number] => {
    const xBytes = new Uint8Array(view.buffer, offset, 32);
    const yBytes = new Uint8Array(view.buffer, offset + 32, 32);
    return [
      { x: bytesToBigIntBE(xBytes), y: bytesToBigIntBE(yBytes) },
      offset + 64,
    ];
  };

  const readString = (
    view: DataView,
    offset: number,
    length: number,
  ): [string, number] => {
    const bytes = new Uint8Array(view.buffer, offset, length);
    return [new TextDecoder().decode(bytes), offset + length];
  };

  const bigintToU256Hex = (n: bigint): string =>
    n.toString(16).padStart(64, '0');

  const buffer = Buffer.from(base64, 'base64');
  const u8 = new Uint8Array(buffer);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let offset = 0;

  const [circuitType, o1] = readU32(view, offset);
  if (circuitType !== 2)
    throw new Error(`Invalid circuit type: ${circuitType}`);
  offset = o1;

  const [circuitSize, o2] = readU32(view, offset);
  if (!Number.isInteger(Math.log2(circuitSize))) {
    throw new Error(`Circuit size must be power of two: ${circuitSize}`);
  }
  offset = o2;

  const [numPublicInputs, o3] = readU32(view, offset);
  offset = o3;

  const [commitmentCount, o4] = readU32(view, offset);
  if (commitmentCount !== COMMITMENT_LABELS_ORDERED.length) {
    throw new Error(
      `Expected ${COMMITMENT_LABELS_ORDERED.length} commitments, got ${commitmentCount}`,
    );
  }
  offset = o4;

  const commitments = {} as Record<CommitmentLabel, G1Point>;

  for (let i = 0; i < commitmentCount; i++) {
    const [labelLength, offsetAfterLength] = readU32(view, offset);
    offset = offsetAfterLength;

    const [label, offsetAfterLabel] = readString(view, offset, labelLength);
    offset = offsetAfterLabel;

    if (!COMMITMENT_LABELS.has(label as CommitmentLabel)) {
      throw new Error(`Unexpected commitment label: ${label}`);
    }

    const [point, nextOffset] = readG1Point(view, offset);
    offset = nextOffset;
    commitments[label as CommitmentLabel] = point;
  }

  const [containsRecursiveProof, o5] = readBool(view, offset);
  if (containsRecursiveProof) throw new Error('Recursive proof not supported');
  offset = o5;

  offset += 4; // skip recursiveProofIndices
  const recursiveProofIndices = 0;

  const vk: VerificationKey = {
    circuitType,
    circuitSize,
    numPublicInputs,
    commitments,
    containsRecursiveProof,
    recursiveProofIndices,
  };

  const fields = [
    BigInt(vk.circuitType),
    BigInt(vk.circuitSize),
    BigInt(vk.numPublicInputs),
    ...COMMITMENT_LABELS_ORDERED.flatMap((label) => [
      vk.commitments[label].x,
      vk.commitments[label].y,
    ]),
    BigInt(vk.containsRecursiveProof ? 1 : 0),
    BigInt(vk.recursiveProofIndices),
  ];

  return '0x' + fields.map(bigintToU256Hex).join('');
}

export function formatPubs(base64: string, options: ProofOptions): string[] {
  const numPublicInputs = getNumPublicInputs(options);

  const raw = Buffer.from(base64, 'base64');
  const inputByteLen = 32 * numPublicInputs;

  if (raw.length < inputByteLen) {
    throw new Error(
      `Proof too small: expected at least ${inputByteLen} bytes, got ${raw.length}`,
    );
  }

  const pubInputBytes = raw.slice(0, inputByteLen);

  const bytesToHexFieldElement = (bytes: Uint8Array): string =>
    '0x' + Buffer.from(bytes).toString('hex');

  const publicInputs: string[] = [];
  for (let i = 0; i < numPublicInputs; i++) {
    const chunk = pubInputBytes.slice(i * 32, (i + 1) * 32);
    publicInputs.push(bytesToHexFieldElement(chunk));
  }

  return publicInputs;
}
