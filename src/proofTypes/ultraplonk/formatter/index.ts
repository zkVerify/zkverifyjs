//TODO: Review these types.  Support Rust Ultraplonk & bb.js ultraplonk
import { UltraPlonkProof, UltraPlonkVk, UltraPlonkPubs } from '../types';

//TODO: Will need Buffer polyfills if not added already.  Check on monday!

export function formatProof(base64: string, numPublicInputs: number): {
  proof: string;
  publicInputs: string[];
} {
  //TODO: This currently returns proof and public inputs as rust ultraplonk 'proof' file contains both.
  // bb.js outputs proof and public signals separately
  // modify code to accept an ultraplonk config and rework this before release.
  const raw = Buffer.from(base64, "base64");

  const inputByteLen = 32 * numPublicInputs;
  if (raw.length < inputByteLen) {
    throw new Error(`Proof too small: expected at least ${inputByteLen} bytes, got ${raw.length}`);
  }

  const pubInputBytes = raw.slice(0, inputByteLen);
  const proofBody = raw.slice(inputByteLen);

  const bytesToHexFieldElement = (bytes: Uint8Array): string =>
      "0x" + Buffer.from(bytes).toString("hex");

  const toHex = (bytes: Uint8Array): string =>
      Buffer.from(bytes).toString("hex");

  const publicInputs: string[] = [];
  for (let i = 0; i < numPublicInputs; i++) {
    const chunk = pubInputBytes.slice(i * 32, (i + 1) * 32);
    publicInputs.push(bytesToHexFieldElement(chunk));
  }

  return {
    proof: "0x" + toHex(proofBody),
    publicInputs
  };
}

export function formatVk(base64: string): string {
  const COMMITMENT_LABELS_ORDERED = [
    "ID_1", "ID_2", "ID_3", "ID_4",
    "Q_1", "Q_2", "Q_3", "Q_4",
    "Q_ARITHMETIC", "Q_AUX", "Q_C", "Q_ELLIPTIC", "Q_M", "Q_SORT",
    "SIGMA_1", "SIGMA_2", "SIGMA_3", "SIGMA_4",
    "TABLE_1", "TABLE_2", "TABLE_3", "TABLE_4",
    "TABLE_TYPE"
  ] as const;

  type CommitmentLabel = typeof COMMITMENT_LABELS_ORDERED[number];
  const COMMITMENT_LABELS = new Set<CommitmentLabel>(COMMITMENT_LABELS_ORDERED);

  const buffer = Buffer.from(base64, "base64");
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  const readU32 = (): number => {
    const value = view.getUint32(offset, false);
    offset += 4;
    return value;
  };

  const readBool = (): boolean => {
    const val = view.getUint8(offset++);
    if (val !== 0 && val !== 1) throw new Error(`Invalid bool value: ${val}`);
    return val === 1;
  };

  const readString = (length: number): string => {
    const bytes = new Uint8Array(view.buffer.slice(offset, offset + length));
    offset += length;
    return new TextDecoder().decode(bytes);
  };

  const readG1Point = (): { x: bigint; y: bigint } => {
    const xBytes = new Uint8Array(view.buffer, offset, 32);
    const yBytes = new Uint8Array(view.buffer, offset + 32, 32);
    offset += 64;
    const bytesToBigIntBE = (b: Uint8Array) => BigInt("0x" + Buffer.from(b).toString("hex"));
    return { x: bytesToBigIntBE(xBytes), y: bytesToBigIntBE(yBytes) };
  };

  const bigintToU256Hex = (n: bigint): string => n.toString(16).padStart(64, "0");

  const circuitType = readU32();
  if (circuitType !== 2) throw new Error(`Invalid circuit type: ${circuitType}`);

  const circuitSize = readU32();
  if (!Number.isInteger(Math.log2(circuitSize))) {
    throw new Error(`Circuit size must be power of two: ${circuitSize}`);
  }

  const numPublicInputs = readU32();

  const commitmentCount = readU32();
  if (commitmentCount !== COMMITMENT_LABELS_ORDERED.length) {
    throw new Error(`Expected ${COMMITMENT_LABELS_ORDERED.length} commitments, got ${commitmentCount}`);
  }

  const commitments: Record<CommitmentLabel, { x: bigint; y: bigint }> = {} as any;

  for (let i = 0; i < commitmentCount; i++) {
    const labelLength = readU32();
    const label = readString(labelLength);
    if (!COMMITMENT_LABELS.has(label as CommitmentLabel)) {
      throw new Error(`Unexpected commitment label: ${label}`);
    }
    commitments[label as CommitmentLabel] = readG1Point();
  }

  const containsRecursiveProof = readBool();
  if (containsRecursiveProof) throw new Error("Recursive proof not supported");

  offset += 4; // skip recursiveProofIndices
  const recursiveProofIndices = 0;

  const fields = [
    BigInt(circuitType),
    BigInt(circuitSize),
    BigInt(numPublicInputs),
    ...COMMITMENT_LABELS_ORDERED.flatMap(label => [
      commitments[label].x,
      commitments[label].y
    ]),
    BigInt(containsRecursiveProof ? 1 : 0),
    BigInt(recursiveProofIndices)
  ];

  return "0x" + fields.map(bigintToU256Hex).join("");
}


export function formatPubs(pubs: UltraPlonkPubs['pubs']): string[] {
  // TODO: proof and pubs are combined in file for rust ultraplonk, separate for bb.js
}