import { CurveType, Library, ProofType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import * as path from 'path';
import { generateAndProve } from "./common/generators/scripts/generateAndProve";

jest.setTimeout(240000);

describe('zkVerifySession.registerVerificationKey error handling', () => {
    let session: zkVerifySession;
    let wallet: string | null = null;
    let envVar: string | null = null;

    beforeEach(async () => {
        wallet = null;
        envVar = null;
    });

    afterEach(async () => {
        if (session) {
            await session.close();
            expect(session.api.isConnected).toBe(false);
            expect(session['provider'].isConnected).toBe(false);
        }
        if (envVar) {
            await walletPool.releaseWallet(envVar);
        }
    });

    it('should successfully register a new vk & throw an error when registering an already registered vk & retrieve an existing vk', async () => {
        [envVar, wallet] = await walletPool.acquireWallet();

        const outDir = path.resolve(__dirname, '../tmp');
        const inputX = 7;

        const {
            verificationKey,
            verifyOutput,
        } = await generateAndProve(outDir, inputX);

        expect(verifyOutput).toContain('OK!');;

        console.log(verificationKey);

        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const { transactionResult } = await session.registerVerificationKey()
            .groth16({
            curve: CurveType.bn254,
            library: Library.snarkjs,
            })
            .execute(verificationKey);

        const result = await transactionResult;

        expect(result.statementHash).toBeDefined();
        expect(typeof result.statementHash).toBe('string');
        expect(result.statementHash).toMatch(/^0x[a-fA-F0-9]+$/);

        const registerAgain = async () => {
            const { transactionResult } = await session
                .registerVerificationKey()
                .groth16({
                    curve: CurveType.bn254,
                    library: Library.snarkjs,
                })
                .execute(verificationKey);

            await transactionResult;
        };

        await expect(registerAgain()).rejects.toThrow(/Verification key has already been registered/i);

        const vkHash = await session.getVkHash({
            proofType: ProofType.groth16,
            config: {
                curve: CurveType.bn254,
                library: Library.snarkjs
            }
        }, verificationKey);

        expect(vkHash).toBeDefined();
        expect(vkHash).toBe(result.statementHash);
    });
});
