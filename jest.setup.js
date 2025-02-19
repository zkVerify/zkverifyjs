const { spawn } = require('child_process');
const path = require('path');

let walletServerProcess;

module.exports = async () => {
    console.log("Starting wallet server for Jest tests...");

    walletServerProcess = spawn('node', [path.resolve(__dirname, 'tests/common/walletServer.js')], {
        stdio: 'inherit',
        env: process.env,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    global.__WALLET_SERVER__ = walletServerProcess;
};
