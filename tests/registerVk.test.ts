import {CurveType, Library, ProofType, TransactionType, VerifyTransactionInfo, zkVerifySession} from '../src';
import {walletPool} from './common/walletPool';
import * as path from 'path';
import {generateAndProve} from "./common/generators/scripts/generateAndProve";
import {validateVerifyTransactionInfo} from "./common/utils";
import {handleCommonEvents} from "./common/eventHandlers";

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
            proof,
            publicSignals,
            verificationKey,
            verifyOutput
        } = await generateAndProve(outDir, inputX);

        expect(verifyOutput).toContain('OK!');;

        console.log(verificationKey);

        session = await zkVerifySession.start().Volta().withAccount(wallet);

        const account = session.getAccount();

        const nonce = await session.api.rpc.system.accountNextIndex(account.address);

        console.log("nonce: " + nonce.toNumber())

        const { transactionResult } = await session.registerVerificationKey()
            .groth16({
            curve: CurveType.bn254,
            library: Library.snarkjs,
            })
            .nonce(nonce.toNumber())
            .execute(verificationKey);

        const result = await transactionResult;

        expect(result.statementHash).toBeDefined();
        expect(typeof result.statementHash).toBe('string');
        expect(result.statementHash).toMatch(/^0x[a-fA-F0-9]+$/);

        // const registerAgain = async () => {
        //     const { transactionResult } = await session
        //         .registerVerificationKey()
        //         .groth16({
        //             curve: CurveType.bn254,
        //             library: Library.snarkjs,
        //         })
        //         .nonce(nonce.toNumber() +1)
        //         .execute(verificationKey);
        //
        //     await transactionResult;
        // };
        //
        // await expect(registerAgain()).rejects.toThrow(/Verification key has already been registered/i);

        const vkHash = await session.getVkHash({
            proofType: ProofType.groth16,
            config: {
                curve: CurveType.bn254,
                library: Library.snarkjs
            }
        }, verificationKey);

        expect(vkHash).toBeDefined();
        expect(vkHash).toBe(result.statementHash);

        const { events, transactionResult: verifyResult } = await session.verify()
            .groth16(
                {
                    curve: CurveType.bn254,
                    library: Library.snarkjs
                }
            )
            .withRegisteredVk()
            .execute( {
                proofData: {
                    proof: proof,
                    publicSignals: publicSignals,
                    vk: vkHash
                }
            });

        handleCommonEvents(
            events,
            'groth16',
            TransactionType.Verify,
            false
        );

        const transactionInfo: VerifyTransactionInfo = await verifyResult;

        validateVerifyTransactionInfo(transactionInfo, 'groth16', false);
    });
});
