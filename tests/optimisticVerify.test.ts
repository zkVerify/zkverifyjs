import { CurveType, Library, ProofType, zkVerifySession } from '../src';
import { walletPool } from './common/walletPool';
import path from "path";
import fs from "fs";
import { OptimisticVerificationResultType } from "../src";
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

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

        session = await zkVerifySession.start().Custom({rpc: "https://customUrl", websocket: customWsUrl}).withAccount(wallet!);

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

    beforeAll(async () => {
        await cryptoWaitReady();
    });

    beforeEach(async () => {
        [envVar, wallet] = await walletPool.acquireWallet();
    });

    afterEach(async () => {
        if (session) await session.close();
        if (envVar) await walletPool.releaseWallet(envVar);
        wallet = undefined;
        envVar = undefined;
    });

    it.skip('should throw an error if optimisticVerify is called on a non-custom network', async () => {
        session = await zkVerifySession.start().Volta().withAccount(wallet!);

        const input = {
            proofData: {
                proof: {},
                publicSignals: [],
                vk: {},
            },
        };

        await expect(
            session.optimisticVerify()
                .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
                .execute(input)
        ).rejects.toThrowError('Optimistic verification is only supported on custom networks.');
    });

    it.skip('should throw an non verification error if optimisticVerify is called and the account has no funds', async () => {
        const unfundedMnemonic = mnemonicGenerate(12);
        session = await zkVerifySession.start().Custom({rpc: "https://customUrl", websocket: 'ws://localhost:9944'}).withAccount(unfundedMnemonic);

        const groth16Data = loadGroth16Data();
        const { proof, publicSignals: defaultPublicSignals, vk } = groth16Data;

        const input = {
            proofData: {
                proof,
                publicSignals: defaultPublicSignals,
                vk,
            },
        };

        const res = await session.optimisticVerify()
                .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
                .execute(input);

        console.log('optimisticVerify failed payment result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(false);
        expect(res.type).toBe(OptimisticVerificationResultType.ValidityError);
        expect(res.verificationError).toBe(false);
        expect(res.code).toBe('InvalidTransaction.Payment');
        expect(res.message.toLowerCase()).toContain('invalidtransaction.payment');
    });

    it.skip('should succeed when called on a custom network with valid proof details', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944');

        const accountAddress = session.getAccount().address;
        const nonce = await session.api.rpc.system.accountNextIndex(accountAddress);

        const formattedProofData = await session.format(
            { proofType: ProofType.groth16, config: { library: Library.snarkjs, curve: CurveType.bls12381 } },
            input.proofData.proof,
            input.proofData.publicSignals,
            input.proofData.vk
        );

        const extrinsic = await session.createExtrinsicHex(ProofType.groth16, formattedProofData);
        const submittableExtrinsic = await session.createExtrinsicFromHex(extrinsic);

        const res = await session
            .optimisticVerify(accountAddress)
            .groth16({ library: Library.snarkjs, curve: CurveType.bls12381 })
            .nonce(nonce.toNumber())
            .execute({ extrinsic: submittableExtrinsic });

        console.log('optimisticVerify success result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(true);
        expect(res.message).toBe('Optimistic Verification Successful!');
        expect(res.type).toBe(OptimisticVerificationResultType.Ok);

        expect(res.code).toBeUndefined();
        expect(res.verificationError).toBeUndefined();
        expect(res.failedIndex).toBeUndefined();
    });

    it.skip('should succeed when specifying the latest block via atBlock()', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944');

        const accountAddress = session.getAccount().address;
        const nonce = await session.api.rpc.system.accountNextIndex(accountAddress);

        const formattedProofData = await session.format(
            { proofType: ProofType.groth16, config: { library: Library.snarkjs, curve: CurveType.bls12381 } },
            input.proofData.proof,
            input.proofData.publicSignals,
            input.proofData.vk
        );

        const extrinsicHex = await session.createExtrinsicHex(ProofType.groth16, formattedProofData);
        const submittableExtrinsic = await session.createExtrinsicFromHex(extrinsicHex);

        const finalizedHash = await session.api.rpc.chain.getFinalizedHead();

        const res = await session
            .optimisticVerify(accountAddress)
            .groth16({ library: Library.snarkjs, curve: CurveType.bls12381 })
            .nonce(nonce.toNumber())
            .atBlock(finalizedHash.toHex())
            .execute({ extrinsic: submittableExtrinsic });

        console.log('optimisticVerify atBlock(finalized) success result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(true);
        expect(res.message).toBe('Optimistic Verification Successful!');
        expect(res.type).toBe(OptimisticVerificationResultType.Ok);
        expect(res.code).toBeUndefined();
        expect(res.verificationError).toBeUndefined()
        expect(res.failedIndex).toBeUndefined();
    });


    it.skip('should fail with verifier dispatch error for invalid VK', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944');

        const res = await session
            .optimisticVerify()
            .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
            .execute(input);

        console.log('optimisticVerify (bad data) result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(false);
        expect(res.type).toBe(OptimisticVerificationResultType.DispatchError);
        expect(res.verificationError).toBe(true);
        expect(res.code).toBe('settlementGroth16Pallet.InvalidVerificationKey');
        expect(res.message.toLowerCase()).toContain('invalid verification key');
    });

    it.skip('should fail when called with incorrect publicSignals', async () => {
        const { input } = await createSessionAndInput('ws://localhost:9944', ['0x1']);

        const res = await session
            .optimisticVerify()
            .groth16({ library: Library.snarkjs, curve: CurveType.bls12381 })
            .execute(input);

        console.log('optimisticVerify (bad publicSignals) result:', JSON.stringify(res, null, 2));

        expect(res.success).toBe(false);
        expect(res.type).toBe(OptimisticVerificationResultType.DispatchError);
        expect(res.verificationError).toBe(true);
        expect(res.code).toBe('settlementGroth16Pallet.VerifyError');
        expect(res.message.toLowerCase()).toContain('verify proof failed');
    });
});
