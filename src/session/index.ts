import {ApiPromise, WsProvider} from '@polkadot/api';
import {KeyringPair} from '@polkadot/keyring/types';
import {establishConnection} from '../connection';
import {setupAccount} from '../account';
import {sendProof, sendProofAndWaitForAttestationEvent} from '../sendProof';
import {ProofTransactionResult} from '../types';
import {EventEmitter} from 'events';

export class zkVerifySession {
    private readonly api: ApiPromise;
    private readonly provider: WsProvider;
    private readonly account?: KeyringPair;
    private readonly emitter: EventEmitter;

    constructor(api: ApiPromise, provider: WsProvider, account?: KeyringPair) {
        this.api = api;
        this.provider = provider;
        this.account = account;
        this.emitter = new EventEmitter();
    }

    static async start(host: string, seedPhrase?: string, customWsUrl?: string): Promise<zkVerifySession> {
        const { api, provider } = await establishConnection(host, customWsUrl);
        let session: zkVerifySession;

        try {
            const account = seedPhrase ? setupAccount(seedPhrase) : undefined;
            session = new zkVerifySession(api, provider, account);
        } catch (error) {
            session = new zkVerifySession(api, provider, undefined);
            await session.close();
            throw new Error(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return session;
    }

    async sendProof(
        proofType: string,
        ...proofData: any[]
    ): Promise<ProofTransactionResult> {
        if (!this.account) {
            throw new Error('No account is set up for this session. A seed phrase is required to send transactions.');
        }

        try {
            return await sendProof(
                {api: this.api, provider: this.provider, account: this.account},
                proofType,
                this.emitter,
                ...proofData
            );
        } catch (error) {
            await this.close();
            throw new Error(`Failed to send proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async sendProofAndWaitForAttestationEvent(
        proofType: string,
        ...proofData: any[]
    ): Promise<ProofTransactionResult> {
        if (!this.account) {
            throw new Error('No account is set up for this session. A seed phrase is required to send transactions.');
        }

        try {
            const result = await sendProofAndWaitForAttestationEvent(
                { api: this.api, provider: this.provider, account: this.account },
                proofType,
                this.emitter,
                ...proofData
            );

            return result;
        } catch (error) {
            await this.close();
            throw new Error(`Failed to send proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    on(event: string, listener: (...args: any[]) => void) {
        this.emitter.on(event, listener);
    }

    async close(): Promise<void> {
        try {
            await this.api.disconnect();

            let retries = 5;
            while (this.provider.isConnected && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries--;
            }

            if (this.provider.isConnected) {
                await this.provider.disconnect();
            }
        } catch (error) {
            throw new Error(`Failed to close the session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
