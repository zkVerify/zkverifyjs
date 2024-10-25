import { ProofProcessor } from '../../types';
import { getProofProcessor } from "../../utils/helpers";
import { ProofType } from "../../config";

export function format(
    proofType: ProofType,
    proof: unknown,
    publicSignals: unknown,
    vk: unknown,
    registeredVk?: boolean
): [formattedVk: any, formattedProof: any, formattedPubs: any] {
    const processor: ProofProcessor = getProofProcessor(proofType);

    if (!processor) {
        throw new Error(`Unsupported proof type: ${proofType}`);
    }

    if (!proof) {
        throw new Error(`${proofType}: Proof is required and cannot be null or undefined.`);
    }
    if (!publicSignals) {
        throw new Error(`${proofType}: Public signals are required and cannot be null or undefined.`);
    }
    if (!vk) {
        throw new Error(`${proofType}: Verification Key must be provided.`);
    }

    let formattedProof, formattedPubs, formattedVk;

    try {
        formattedProof = processor.formatProof(proof);
    } catch (error) {
        const proofSnippet =
            typeof proof === 'string'
                ? proof.slice(0, 50)
                : JSON.stringify(proof).slice(0, 50);
        throw new Error(
            `Failed to format ${proofType} proof: ${error instanceof Error ? error.message : 'Unknown error'}. Proof snippet: "${proofSnippet}..."`,
        );
    }

    try {
        formattedPubs = processor.formatPubs(publicSignals);
    } catch (error) {
        const pubsSnippet = Array.isArray(publicSignals)
            ? JSON.stringify(publicSignals).slice(0, 50)
            : publicSignals?.toString().slice(0, 50);

        throw new Error(
            `Failed to format ${proofType} public signals: ${error instanceof Error ? error.message : 'Unknown error'}. Public signals snippet: "${pubsSnippet}..."`,
        );
    }

    try {
        if (registeredVk) {
            formattedVk = { Hash: vk };
        } else {
            formattedVk = { Vk: processor.formatVk(vk) };
        }
    } catch (error) {
        const vkSnippet =
            typeof vk === 'string'
                ? vk.slice(0, 50)
                : JSON.stringify(vk).slice(0, 50);

        throw new Error(
            `Failed to format ${proofType} verification key: ${error instanceof Error ? error.message : 'Unknown error'}. Verification key snippet: "${vkSnippet}..."`,
        );
    }

    return [formattedVk, formattedProof, formattedPubs];
}
