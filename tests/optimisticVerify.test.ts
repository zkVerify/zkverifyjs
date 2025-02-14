import { CurveType, Library, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import path from "path";
import fs from "fs";

jest.setTimeout(180000);

describe('optimisticVerify functionality', () => {
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

        session = await zkVerifySession.start().Custom(customWsUrl).withAccount(wallet!);

        return {
            session,
            input: {
                proofData: {
                    proof,
                    publicSignals: publicSignals || defaultPublicSignals,
                    vk,
                },
            },
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

    it('should throw an error if optimisticVerify is called on a non-custom network', async () => {
        session = await zkVerifySession.start().Testnet().withAccount(wallet!);

        const input = {
            proofData: {
                proof: {},
                publicSignals: [],
                vk: {},
            },
        };

        await expect(
            session.optimisticVerify()
                .groth16(Library.snarkjs, CurveType.bn128)
                .execute(input)
        ).rejects.toThrowError('Optimistic verification is only supported on custom networks.');
    });

    it.skip('should succeed when called on a custom network with valid proof details', async () => {
        const { input } = await createSessionAndInput('ws://custom-url');

        const builder = session.optimisticVerify().groth16(Library.snarkjs, CurveType.bls12381);
        const { success, message } = await builder.execute(input);

        expect(message).toBe("Optimistic Verification Successful!");
        expect(success).toBe(true);
    });

    it.skip('should fail when called with incorrect data', async () => {
        const { input } = await createSessionAndInput('ws://custom-url');

        const builder = session.optimisticVerify().groth16(Library.snarkjs, CurveType.bn128);
        const { success, message } = await builder.execute(input);

        expect(success).toBe(false);
        expect(message).toContain("settlementGroth16Pallet.InvalidVerificationKey: Provided an invalid verification key.");
    });

    it.skip('should fail when called with incorrect publicSignals', async () => {
        const { input } = await createSessionAndInput('ws://custom-url', ["0x1"]);

        const builder = session.optimisticVerify().groth16(Library.snarkjs, CurveType.bls12381);
        const { success, message } = await builder.execute(input);

        expect(success).toBe(false);
        expect(message).toContain("settlementGroth16Pallet.VerifyError: Verify proof failed.");
    });
});
