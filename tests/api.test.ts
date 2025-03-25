import { zkVerifySession } from '../src';

jest.setTimeout(180000);

describe('zkVerifySession Integration Test - Polkadot API', () => {
    let session: zkVerifySession;

    beforeAll(async () => {
        session = await zkVerifySession.start().Volta().readOnly();
    });

    afterAll(async () => {
        await session.close();
    });

    it('should initialize session.api and query basic chain information', async () => {
        expect(session.api).toBeDefined();

        const chain = await session.api.rpc.system.chain();
        const version = await session.api.rpc.system.version();

        expect(chain).toBeTruthy();
        expect(version).toBeTruthy();

        console.log(`Connected to chain: ${chain}, version: ${version}`);
    });
});
