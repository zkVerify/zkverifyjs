import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

const execFile = promisify(execFileCb) as (
    file: string,
    args?: readonly string[],
    options?: any
) => Promise<{ stdout: string; stderr: string }>;

export async function generateAndProve(baseDir: string, x: number) {
    const circuitTag = crypto.randomUUID().replace(/-/g, '');
    const circuitName = `circuit_${circuitTag}`;
    const circuitFile = path.join(baseDir, `${circuitName}.circom`);
    const outDir = path.join(baseDir, circuitName);
    const ptauPath = path.resolve(__dirname, '../ptau/powersOfTau28_hez_final_10.ptau');

    const constraintCount = crypto.randomInt(2, 20);

    const circuitCode = `
template UniqueCircuit() {
    signal input x;
    signal output y;
    signal tmp[${constraintCount}];

    tmp[0] <== x * x + 1;

    ${Array.from({ length: constraintCount - 1 }, (_, i) => `
    tmp[${i + 1}] <== tmp[${i}] * tmp[${i}] + ${i + 2};
    `).join('\n')}

    y <== tmp[${constraintCount - 1}];
}

component main = UniqueCircuit();
`;

    try {
        await fs.ensureDir(outDir);
        await fs.writeFile(circuitFile, circuitCode);

        const inputPath = path.join(outDir, 'input.json');
        await fs.writeJSON(inputPath, { x });

        const witnessPath = path.join(outDir, 'witness.wtns');
        const proofPath = path.join(outDir, 'proof.json');
        const publicPath = path.join(outDir, 'public.json');
        const zkeyPath = path.join(outDir, 'circuit.zkey');
        const vkPath = path.join(outDir, 'vk.json');
        const r1csPath = path.join(outDir, `${circuitName}.r1cs`);

        await execFile('circom', [circuitFile, '--r1cs', '--wasm', '--sym', '-o', outDir]);
        await execFile('snarkjs', ['groth16', 'setup', r1csPath, ptauPath, zkeyPath]);
        await execFile('snarkjs', ['wtns', 'calculate', `${outDir}/${circuitName}_js/${circuitName}.wasm`, inputPath, witnessPath]);
        await execFile('snarkjs', ['groth16', 'prove', zkeyPath, witnessPath, proofPath, publicPath]);
        await execFile('snarkjs', ['zkey', 'export', 'verificationkey', zkeyPath, vkPath]);

        const vkRaw = await fs.readFile(vkPath, 'utf8');
        const { stdout } = await execFile('snarkjs', ['groth16', 'verify', vkPath, publicPath, proofPath]);

        return {
            circuitTag,
            x,
            y: x + 1,
            verifyOutput: stdout.trim(),
            publicSignals: await fs.readJSON(publicPath),
            proof: await fs.readJSON(proofPath),
            verificationKey: JSON.parse(vkRaw),
        };
    } catch (err) {
        console.error(`generateAndProve failed`, err);
        throw err;
    }
}
