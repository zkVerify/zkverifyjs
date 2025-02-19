const Fastify = require('fastify');
const { Mutex } = require('async-mutex');

const fastify = Fastify();
const wallets = new Map(
    Object.entries(process.env).filter(([key]) => key.startsWith('SEED_PHRASE'))
);

const requestQueue = [];
const mutex = new Mutex();

fastify.get('/wallet', async (request, reply) => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const index = requestQueue.indexOf(resolve);
            if (index !== -1) requestQueue.splice(index, 1);
            reject(reply.code(408).send({ error: "Wallet request timed out" }));
        }, 60000);

        mutex.runExclusive(async () => {
            if (wallets.size > 0) {
                const [key, wallet] = wallets.entries().next().value;
                wallets.delete(key);
                clearTimeout(timeout);
                return resolve(reply.send({ key, wallet }));
            }

            requestQueue.push((wallet) => {
                clearTimeout(timeout);
                resolve(reply.send(wallet));
            });
        });
    });
});

fastify.post('/release', async (request, reply) => {
    const { key } = request.body;
    if (!key) {
        return reply.code(400).send({ error: "Invalid request, missing key" });
    }

    const wallet = process.env[key];
    if (!wallet) {
        return reply.code(400).send({ error: `Wallet for key ${key} not found in env vars` });
    }

    await mutex.runExclusive(() => {
        if (requestQueue.length > 0) {
            const resolve = requestQueue.shift();
            if (resolve) {
                return resolve({ key, wallet });
            }
        }
        wallets.set(key, wallet);
    });

    reply.send({ success: true });
});

fastify.listen({ port: 3001 }, () => console.log("Wallet API running on port 3001"));
