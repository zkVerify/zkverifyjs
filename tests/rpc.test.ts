import { CurveType, FormattedProofData, Library, ProofType, zkVerifySession } from '../src';
import path from "path";
import fs from "fs";

jest.setTimeout(60000);

describe('Custom RPC Integration Test', () => {
    let session: zkVerifySession;

    beforeAll(async () => {
        session = await zkVerifySession.start().Volta().readOnly();
    });

    afterAll(async () => {
        await session.close();
    });

    it('should retrieve a VK hash via the rpc endpoint', async () => {
        const dataPath = path.join(__dirname, 'common/data', 'groth16_snarkjs_bn128.json');
        const groth16Data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        const vkHash = await session.getVkHash({
            proofType: ProofType.groth16,
            config: {
                library: Library.snarkjs,
                curve: CurveType.bn128
            }
        },
        groth16Data.vk);

        expect(typeof vkHash).toBe('string');
        expect(vkHash.length).toBeGreaterThan(2);
        expect(vkHash.startsWith('0x')).toBe(true);
    });

});
