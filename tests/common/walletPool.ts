import { Mutex } from 'async-mutex';

class WalletPool {
    private readonly pool: Map<string, string>;
    private readonly availableWallets: Map<string, string>;
    private mutex = new Mutex();

    constructor() {
        this.pool = this.getAllSeedPhrases();
        this.availableWallets = new Map(this.pool);
    }

    private getAllSeedPhrases(): Map<string, string> {
        const seedPhrases: [string, string][] = Object.keys(process.env)
            .filter((key) => key.startsWith('SEED_PHRASE'))
            .sort((keyA, keyB) => {
                const numA = parseInt(keyA.replace('SEED_PHRASE_', ''), 10);
                const numB = parseInt(keyB.replace('SEED_PHRASE_', ''), 10);
                return numA - numB;
            })
            .map((key) => {
                let value = process.env[key]?.trim();

                if (!value) {
                    console.error(`❌ ERROR: ${key} is missing or empty.`);
                    return null;
                }

                const words = value.split(/\s+/);
                if (words.length !== 12) {
                    console.error(`❌ ERROR: ${key} should have 12 words but has ${words.length}.`);
                    return null;
                }

                if (value.includes('\n')) {
                    console.error(`❌ ERROR: ${key} contains newline characters.`);
                    return null;
                }

                const formattedValue = words.join(" ");
                if (value !== formattedValue) {
                    console.error(`❌ ERROR: ${key} has extra spaces before, after, or between words.`);
                    return null;
                }

                return [key, value] as [string, string];
            })
            .filter((entry): entry is [string, string] => entry !== null);

        return new Map(seedPhrases);
    }

    async acquireWallet(): Promise<[string, string]> {
        return this.mutex.runExclusive(async () => {
            while (this.availableWallets.size === 0) {
                console.warn(`Waiting for an available wallet... (${this.getAvailableWalletCount()} remaining)`);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            const entry = this.availableWallets.entries().next().value;
            if (!entry) {
                throw new Error("No available wallet found.");
            }

            const [envVar, wallet] = entry;
            this.availableWallets.delete(envVar);

            return [envVar, wallet];
        });
    }

    async releaseWallet(envVar: string): Promise<void> {
        return this.mutex.runExclusive(() => {
            if (!this.pool.has(envVar)) {
                throw new Error(`Invalid release: Wallet ${envVar} does not belong to the pool.`);
            }

            this.availableWallets.set(envVar, this.pool.get(envVar)!);
        });
    }

    getAvailableWalletCount(): number {
        return this.availableWallets.size;
    }
}

export const walletPool = new WalletPool();
