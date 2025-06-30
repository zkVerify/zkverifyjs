import axios, { AxiosResponse } from 'axios';

class WalletPool {
    private readonly walletServerUrl: string;
    private readonly maxRetries = 20;
    private readonly baseDelay = 500;

    constructor() {
        const port = process.env.WALLET_POOL_PORT || '3001';
        this.walletServerUrl = `http://localhost:${port}`;
    }

    async acquireWallet(): Promise<[string, string]> {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[walletPool] Attempt ${attempt} to acquire wallet...`);

                const response: AxiosResponse<{
                    key?: string;
                    wallet?: string;
                    available?: boolean;
                }> = await axios.get(`${this.walletServerUrl}/wallet`, { timeout: 5000 });

                if (response.data?.available && response.data.key && response.data.wallet) {
                    console.log(`[walletPool] Acquired wallet: ${response.data.wallet}`);
                    return [response.data.key, response.data.wallet];
                }

                console.log('[walletPool] No wallet available, retrying...');
            } catch (err: any) {
                const isConnectionError =
                    err.code === 'ECONNREFUSED' || err.message.includes('timeout');
                console.warn(`[walletPool] Attempt ${attempt} failed: ${err.message}`);

                if (!isConnectionError) {
                    throw new Error(`Non-retryable error while acquiring wallet: ${err.message}`);
                }
            }

            const delay = Math.min(this.baseDelay * attempt, 3000);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        throw new Error('[walletPool] Exceeded max retries while acquiring wallet.');
    }

    async releaseWallet(envVar: string): Promise<void> {
        try {
            console.log(`[walletPool] Releasing wallet: ${envVar}`);
            const response = await axios.post(`${this.walletServerUrl}/release`, {
                key: envVar,
            });

            if (!response.data?.success) {
                console.warn(`[walletPool] Wallet release may have failed for ${envVar}`);
            } else {
                console.log(`[walletPool] Wallet released: ${envVar}`);
            }
        } catch (error: any) {
            console.error(`[walletPool] Failed to release wallet ${envVar}: ${error.message}`);
        }
    }
}

export const walletPool = new WalletPool();
