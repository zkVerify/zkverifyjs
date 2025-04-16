const Fastify = require('fastify');
const { Mutex } = require('async-mutex');
const { Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
require('dotenv').config()

const fastify = Fastify();
const availableWallets = new Map();
const inUseWallets = new Map();
const requestQueue = [];
const mutex = new Mutex();

async function initializeWallets() {
    const keyring = new Keyring({ type: 'sr25519' });
    const invalidKeys = [];

    let total = 0;
    let valid = 0;

    await cryptoWaitReady();

    Object.entries(process.env)
        .filter(([key]) => key.startsWith('SEED_PHRASE'))
        .forEach(([key, seed]) => {
            total++;

            const words = seed.trim().split(/\s+/);
            if (words.length !== 12) {
                console.error(`❌ Invalid seed format for ${key}: does not contain exactly 12 words`);
                invalidKeys.push(key);
                return;
            }

            try {
                keyring.addFromUri(seed);
                availableWallets.set(key, seed);
                valid++;
            } catch (err) {
                invalidKeys.push(key);
            }
        });

    console.log(`-- Wallet Pool Initialized -- `);
    console.log(`- Total Seed Phrases Found: ${total}`);

    console.log(`- ✅   Valid Wallets: ${valid}`);
    console.log(`- ❌   Invalid Wallets: ${invalidKeys.length}`);
    if (invalidKeys.length > 0) {
        console.log(`- Invalid Env Keys: ${invalidKeys.join(', ')}`);
    }

    if (valid === 0) {
        console.error("🚨  No valid wallets available. Shutting down.");
        process.exit(1);
    }
}

fastify.get('/wallet', async (request, reply) => {
    return mutex.runExclusive(async () => {
        if (availableWallets.size > 0) {
            const [key, wallet] = availableWallets.entries().next().value;
            availableWallets.delete(key);
            inUseWallets.set(key, wallet);
            return { key, wallet, available: true };
        }
        requestQueue.push(request.id);
        return { available: false, queuePosition: requestQueue.indexOf(request.id) };
    }).then(result => reply.send(result));
});

fastify.post('/release', async (request, reply) => {
    const { key } = request.body;
    if (!key || !inUseWallets.has(key)) {
        return reply.code(400).send({ error: "Invalid request or wallet not in use" });
    }

    await mutex.runExclusive(async () => {
        const wallet = inUseWallets.get(key);
        inUseWallets.delete(key);

        function addWallet(){
            availableWallets.set(key, wallet);
            if(requestQueue.length > 0){
                requestQueue.shift();
            }
        }
        setTimeout(addWallet, 0);

        reply.send({ success: true });
    });
});

initializeWallets().then(() => {
    fastify.listen({ port: 3001 }, () => {});
}).catch((error) => {
    console.error("Failed to initialize wallets:", error);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('👋 Wallet server received SIGTERM. Shutting down.');
    fastify.close().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('👋 Wallet server received SIGINT. Shutting down.');
    fastify.close().then(() => process.exit(0));
});