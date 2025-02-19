import axios from 'axios';

class WalletPool {
    private readonly walletServerUrl: string;

    constructor(serverUrl: string = 'http://localhost:3001') {
        this.walletServerUrl = serverUrl;
    }

    /**
     * Requests a wallet from the Fastify server.
     * If no wallets are available, the request will wait until one is released (max 60s).
     */
    async acquireWallet(): Promise<[string, string]> {
        try {
            const response = await axios.get(`${this.walletServerUrl}/wallet`, { timeout: 61000 });
            return [response.data.key, response.data.wallet];
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to acquire wallet: ${error.message}`);
            } else if (error instanceof Error) {
                throw new Error(`Failed to acquire wallet: ${error.message}`);
            } else {
                throw new Error(`Failed to acquire wallet: ${JSON.stringify(error)}`);
            }
        }
    }

    /**
     * Releases a wallet back to the Fastify server using only its key (envVar).
     */
    async releaseWallet(envVar: string): Promise<void> {
        try {
            await axios.post(`${this.walletServerUrl}/release`, { key: envVar });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to release wallet: ${error.message}`);
            } else if (error instanceof Error) {
                throw new Error(`Failed to release wallet: ${error.message}`);
            } else {
                throw new Error(`Failed to release wallet: ${JSON.stringify(error)}`);
            }
        }
    }
}

export const walletPool = new WalletPool();
