import axios, { AxiosResponse } from 'axios';

class WalletPool {
    private readonly walletServerUrl: string;

    constructor(serverUrl: string = 'http://localhost:3001') {
        this.walletServerUrl = serverUrl;
    }

    async acquireWallet(): Promise<[string, string]> {
        try {
            while (true) {
                const response: AxiosResponse<{ key?: string; wallet?: string; available?: boolean }> = await axios.get(`${this.walletServerUrl}/wallet`, { timeout: 181000 });

                if (response.data && response.data.available && response.data.key && response.data.wallet) {
                    return [response.data.key, response.data.wallet];
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error(`Failed to acquire wallet: ${error}`);
            throw new Error(`Failed to acquire wallet: ${error}`);
        }
    }

    async releaseWallet(envVar: string): Promise<void> {
        try {
            const response = await axios.post(`${this.walletServerUrl}/release`, { key: envVar });

            if (!(response.data && response.data.success)) {
                console.error(`Wallet ${envVar} release may have failed`);
            }
        } catch (error) {
            console.error(`Failed to release wallet: ${envVar} - ${error}`);
        }
    }
}

export const walletPool = new WalletPool();