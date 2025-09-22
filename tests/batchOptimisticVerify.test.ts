import { CurveType, Library, OptimisticVerificationResultType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import path from "path";
import fs from "fs";

jest.setTimeout(180000);

describe('batchOptimisticVerify functionality', () => {
    let session: zkVerifySession;
    let wallet: string | undefined;
    let envVar: string | undefined;

    const loadGroth16Data = () => {
        const dataPath = path.join(__dirname, 'common/data', 'groth16_snarkjs_bls12381.json');
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    };

    const createSessionAndInput = async (customWsUrl: string, publicSignals?: string[]) => {
        const groth16Data = loadGroth16Data();
        const { proof, publicSignals: defaultPublicSignals, vk } = groth16Data;

        session = await zkVerifySession.start()
            .Custom({ rpc: "https://customUrl", websocket: customWsUrl })
            .withAccount(wallet!);

        return {
            session,
            input: [{
                proofData: {
                    proof,
                    publicSignals: publicSignals || defaultPublicSignals,
                    vk,
                },
            },
            {
                proofData: {
                    proof,
                    publicSignals: publicSignals || defaultPublicSignals,
                    vk,
                },
            }],
        };
    };

    beforeEach(async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
    });

    afterEach(async () => {
        if (session) await session.close();
        if (envVar) await walletPool.releaseWallet(envVar);
        wallet = undefined;
        envVar = undefined;
    });

    it.skip('should throw an error if batchOptimisticVerify is called on a non-custom network', async () => {
        session = await zkVerifySession.start().Volta().withAccount(wallet!);

        const input = [{
            proofData: {
                proof: {},
                publicSignals: [],
                vk: {},
            },
        }];

        await expect(
            session.batchOptimisticVerify()
                .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
                .execute(input)
        ).rejects.toThrowError('Optimistic batch verification is only supported on custom networks.');
    });

    it.skip('should succeed when called on a custom network with valid proof details', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944');

        const builder = session.batchOptimisticVerify()
            .groth16({ library: Library.snarkjs, curve: CurveType.bls12381 });

        const { success, message } = await builder.execute(input);

        expect(message).toBe("Optimistic Verification Successful!");
        expect(success).toBe(true);
    });

    it.skip('should fail when called with incorrect data', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944');
        input[0].proofData!.vk = {};

        const builder = session.batchOptimisticVerify()
            .groth16({ library: Library.snarkjs, curve: CurveType.bn128 });

        const { success, message } = await builder.execute(input);

        expect(success).toBe(false);
        expect(message).toContain("Proof at index 0 failed: Optimistic verification failed: Failed to format groth16 verification key");
    });

    it.skip('should fail when called with incorrect publicSignals', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944', ['0x1']);

        const builder = session
            .batchOptimisticVerify()
            .groth16({ library: Library.snarkjs, curve: CurveType.bls12381 });

        const res = await builder.execute(Array.isArray(input) ? input : [input]);

        console.log('batchOptimisticVerify (bad publicSignals) result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(false);
        expect(res.type).toBe(OptimisticVerificationResultType.DispatchError);
        expect(res.verificationError).toBe(true);
        expect(res.code).toBe('settlementGroth16Pallet.VerifyError');
        expect(res.message).toMatch(/Proof at index \d+ failed:/);
        if (res.failedIndex !== undefined) expect(res.failedIndex).toBe(0);
    });
});
