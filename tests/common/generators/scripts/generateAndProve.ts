import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export async function generateAndProve(baseDir: string, x: number) {
    const circuitTag = crypto.randomUUID().replace(/-/g, '');
    const circuitName = `circuit_${circuitTag}`;
    const circuitFile = path.join(baseDir, `${circuitName}.circom`);
    const outDir = path.join(baseDir, circuitName);
    const ptauPath = path.resolve(__dirname, '../ptau/powersOfTau28_hez_final_10.ptau');

    const constraintCount = crypto.randomInt(2, 20);

    // Generate random constants for each constraint
    const randomConstants = Array.from({ length: constraintCount }, () => crypto.randomInt(1, 2 ** 31));
    // Optionally, add a random salt
    const salt = crypto.randomInt(1, 2 ** 31);

    const circuitCode = `
template UniqueCircuit(salt) {
    signal input x;
    signal output y;
    signal tmp[${constraintCount}];

    tmp[0] <== x * x + salt + ${randomConstants[0]};

    ${Array.from({ length: constraintCount - 1 }, (_, i) => `
    tmp[${i + 1}] <== tmp[${i}] * tmp[${i}] + salt + ${randomConstants[i + 1]};
    `).join('\n')}

    y <== tmp[${constraintCount - 1}];
}

component main = UniqueCircuit(${salt});
`;

    try {
        await fs.ensureDir(outDir);
        console.log(`Circuit: ${circuitName}`);
        await fs.writeFile(circuitFile, circuitCode);
        console.log(`Circuit SHA-256: ${crypto.createHash('sha256').update(circuitCode).digest('hex')}`);

        const inputPath = path.join(outDir, 'input.json');
        await fs.writeJSON(inputPath, { x });

        const witnessPath = path.join(outDir, 'witness.wtns');
        const proofPath = path.join(outDir, 'proof.json');
        const publicPath = path.join(outDir, 'public.json');
        const zkeyPath = path.join(outDir, 'circuit.zkey');
        const vkPath = path.join(outDir, 'vk.json');
        const r1csPath = path.join(outDir, `${circuitName}.r1cs`);

        console.log(`Compiling circuit...`);
        await execa('circom', [circuitFile, '--r1cs', '--wasm', '--sym', '-o', outDir]);

        const r1csHash = crypto.createHash('sha256').update(await fs.readFile(r1csPath)).digest('hex');
        console.log(`R1CS SHA-256: ${r1csHash}`);

        console.log(`Running trusted setup...`);
        await execa('snarkjs', ['groth16', 'setup', r1csPath, ptauPath, zkeyPath]);

        console.log(`Generating witness...`);
        await execa('snarkjs', ['wtns', 'calculate', `${outDir}/${circuitName}_js/${circuitName}.wasm`, inputPath, witnessPath]);

        console.log(`Generating proof...`);
        await execa('snarkjs', ['groth16', 'prove', zkeyPath, witnessPath, proofPath, publicPath]);

        console.log(`Exporting verification key...`);
        await execa('snarkjs', ['zkey', 'export', 'verificationkey', zkeyPath, vkPath]);

        const vkRaw = await fs.readFile(vkPath, 'utf8');
        const vkHash = crypto.createHash('sha256').update(vkRaw).digest('hex');
        console.log(`VK SHA-256: ${vkHash}`);

        const { stdout } = await execa('snarkjs', ['groth16', 'verify', vkPath, publicPath, proofPath]);
        console.log(`Verification: ${stdout.trim()}`);

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
