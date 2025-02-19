module.exports = async () => {
    console.log("Stopping wallet server after Jest tests...");

    if (global.__WALLET_SERVER__) {
        global.__WALLET_SERVER__.kill();
    }
};
