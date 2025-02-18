<!-- This is a generated file. Do not modify directly. --> 
 ## zkverifyjs Instructions

The `zkverifyjs` package is a TypeScript library designed to facilitate sending proofs to zkVerify for verification, listening for transaction events, and waiting for transaction finalization. The package is built with an intuitive API that allows developers to handle real-time transaction events and await final results.

Currently the following proof verifiers are supported:

* FFlonk

* Groth16 (BN128, BN254, BLS12-381 elliptic curves)
  * Note - Must include `Library` and `CurveType` e.g. `.groth16(Library.gnark, CurveType.bn128)`

* Risc0 `V1_0`, `V1_1`, `V1_2`

  * Note - Version must be included as a ProofData input for Risc0

  ```typescript
  .execute({ proofData: { 
      vk: vk,
      proof: proof,
      publicSignals: publicSignals,
      version: 'V1_2' }
  })
  ```

* Ultraplonk

* Space and Time

## Installation

To install the package, use npm or yarn:

```bash
npm install zkverifyjs
```

## Usage

### Creating a Session

Before sending a proof, you need to start a session. A session establishes a connection to the zkVerify network and optionally sets up an account using a seed phrase (required for sending transactions).

1. Read-Only Session with Supported Network:

```typescript
const session = await zkVerifySession.start()
        .Testnet(); // Preconfigured network selection
// No full account session as .withAccount() has not been used.
```

2. Read-Only Session with Custom WebSocket:

```typescript
const session = await zkVerifySession.start()
        .Custom("wss://testnet-rpc.zkverify.io"); // Custom network
// No full account session as .withAccount() has not been used.
```

3. Full Backend Session (send transactions) with Supported Network:

```typescript
const session = await zkVerifySession.start()
        .Testnet() // Preconfigured network selection
        .withAccount(process.env.SEED_PHRASE!); // Full session with active account
```

4. Full Backend Session (send transactions)  with Custom WebSocket:

```typescript
const session = await zkVerifySession.start()
        .Testnet() // Custom network
        .withAccount(); // Full session with active account
```

5. Full Frontend Browser Session (send transactions)  with Supported Network:

```typescript
const session = await zkVerifySession.start()
        .Testnet()
        .withWallet({
          source: selectedWallet,
          accountAddress: selectedAccount,
        }); // Uses browser session context "window"
```

6. Full Frontend Browser Session (send transactions)  with Custom WebSocket:

```typescript
const session = await zkVerifySession.start()
        .Custom("wss://testnet-rpc.zkverify.io") // Custom network
        .withWallet({
          source: selectedWallet,
          accountAddress: selectedAccount,
        }); // Uses browser session context "window"
```

Not specifying `withAccount()` or `withWallet()` will start a read-only session, transaction methods cannot be used, and only calls to read data are allowed:

```typescript
import { zkVerifySession } from 'zkverifyjs';

const readOnlySession = await zkVerifySession.start().Testnet();
```

### Verifying a Proof

The zkVerifySession.verify method allows you to configure and execute a verification process using a fluent syntax. This approach offers a more readable and flexible way to set up your verification options before executing the proof verification.

1. Backend / server side after establishing a session with `withAccount()`

```typescript
const { events, transactionResult } = await session
        .verify()
        .fflonk()                                  // Select the proof type (e.g., fflonk)
        .nonce(1)                                  // Set the nonce (optional)
        .waitForPublishedAttestation()             // Wait for the attestation to be published (optional)
        .withRegisteredVk()                        // Indicate that the verification key is already registered (optional)
        .execute({ proofData: { 
            vk: vk,
            proof: proof,
            publicSignals: publicSignals }
        });  // Execute the verification with the provided proof data

```

2. Frontend after establishing a session with `withWallet()`

```typescript
import {CurveType} from "./index";

const {events, transactionResult} = await session.verify()
        .groth16(Library.snarkjs, CurveType.bn128)
        .execute({
          proofData: {
            vk: vk,
            proof: proof,
            publicSignals: publicSignals
          }
        });

events.on('ErrorEvent', (eventData) => {
  console.error(JSON.stringify(eventData));
});

let transactionInfo = null;
try {
  transactionInfo = await transactionResult;
} catch (error) {
  throw new Error(`Transaction failed: ${error.message}`);
}
```

### Registering a Verification Key & Submitting a proof with the Statement Hash

Register your Verification Key on chain and use it in future proof submissions by specifying the `registeredVk()` option.

```typescript
const { events, transactionResult } = await session.registerVerificationKey().fflonk().execute(vk);
const vkTransactionInfo: VKRegistrationTransactionInfo = await transactionResult;

const {events: verifyEvents, transactionResult: verifyTransactionResult} = await session.verify()
        .fflonk()
        .withRegisteredVk() // Option needs to be specified as we're using the registered statement hash.
        .execute({ proofData: {
            vk: vkTransactionInfo.statementHash!,
            proof: proof,
            publicSignals: publicSignals }
        });;

const verifyTransactionInfo: VerifyTransactionInfo = await verifyTransactionResult;
```

### Listening to Events

You can listen for transaction events using the events emitter. Common events include:

* `includedInBlock`: Triggered when the transaction is included in a block.
* `finalized`: Triggered when the transaction is finalized.
* `attestationConfirmed`: Triggered when the NewElement event is raised by the zkVerify chain.
* `error`: Triggered if an error occurs during the transaction process.

```typescript
const { events, transactionResult } = await session.verify().risc0().execute({ proofData: {
    vk: vk,
    proof: proof,
    publicSignals: publicSignals }
});;

events.on('includedInBlock', (eventData) => {
    console.log('Transaction included in block:', eventData);
});

events.on('finalized', (eventData) => {
    console.log('Transaction finalized:', eventData);
});

events.on('attestationConfirmed', (eventData) => {
    console.log('Attestation Event Raised:', eventData);
});

events.on('error', (error) => {
    console.error('An error occurred during the transaction:', error);
});
```

### Awaiting the Final Transaction Result

To await the final result of the transaction, use the transactionResult promise. This resolves with the final transaction details after the transaction is finalized in a block.

```typescript
const { events, transactionResult } = await session.verify()
  .groth16(Library.gnark, CurveType.bls12381)
  .execute({ proofData: {
      vk: vk,
      proof: proof,
      publicSignals: publicSignals }
  });;

const result = await transactionResult;
console.log('Final transaction result:', result);
```

### Wait for the Attestation to be published

Wait for the NewElement event to be published before the transaction info is returned back by the promise.  Occurs around every ~60s.

```typescript
const { events, transactionResult } = await session.verify().risc0()
    .waitForPublishedAttestation()
    .execute({ proofData: {
        vk: vk,
        proof: proof,
        publicSignals: publicSignals }
    });;

const transactionInfo: VerifyTransactionInfo = await transactionResult;

console.log(transactionInfo.attestationConfirmed); // Expect 'true'
console.log(JSON.stringify(transactionInfo.attestationEvent)) // Attestation Event details.
```

### Optimistic Proof Verification

In order to get a quick response on whether a proof is valid or not without waiting for the network / block inclusion / finality, the `optimisticVerify` function is provided.

Under the hood this is a wrapper around the `dryRun()` call and requires a `Custom` zkVerify session and the target node to be running with the unsafe flags.

**⚠ WARNING:**
**Bear in mind unlike regular transactions, dryRun does not consume gas or fees, meaning it can be called repeatedly without cost to the user - consuming CPU and memory resources on the node and leaving it exposed to denial of service.**

```shell
--rpc-methods Unsafe --unsafe-rpc-external
```

Connect to your custom node that has the unsafe flags set, and send the proof:

```typescript
  // Optimistically verify the proof (requires Custom node running in unsafe mode for dryRun() call)
  const session = await zkVerifySession.start()
          .Custom('ws://my-custom-node')
          .withAccount('your-seed-phrase');

  const { success, message } = session.optimisticVerify()
          .risc0()
          .execute({ proofData: {
              vk: vk,
              proof: proof,
              publicSignals: publicSignals }
          });;
```

### Example Usage

```typescript
import { zkVerifySession, ZkVerifyEvents, TransactionStatus, VerifyTransactionInfo } from 'zkverifyjs';

async function executeVerificationTransaction(proof: unknown, publicSignals: unknown, vk: unknown) {
  // Start a new zkVerifySession on a Custom network (replace 'your-seed-phrase' with actual value)
  const session = await zkVerifySession.start()
          .Custom('ws://my-custom-node')
          .withAccount('your-seed-phrase');
  
  // Optimistically verify the proof (requires Custom node running in unsafe mode for dryRun() call)
  const { success, message } = session.optimisticVerify()
          .risc0()
          .execute({ proofData: {
              vk: vk,
              proof: proof,
              publicSignals: publicSignals }
          });;
          
  if(!success) {
      throw new Error("Optimistic Proof Verification Failed")
  }
  
  // Add additional dApp logic using fast response from zkVerify
  // Your logic here
  // Your logic here

  // Execute the verification transaction on zkVerify chain
  const { events, transactionResult } = await session.verify().risc0()
          .waitForPublishedAttestation()
          .execute({ proofData: {
              vk: vk,
              proof: proof,
              publicSignals: publicSignals }
          });;

  // Listen for the 'includedInBlock' event
  events.on(ZkVerifyEvents.IncludedInBlock, (eventData) => {
    console.log('Transaction included in block:', eventData);
    // Handle the event data as needed
  });

  // Listen for the 'finalized' event
  events.on(ZkVerifyEvents.Finalized, (eventData) => {
    console.log('Transaction finalized:', eventData);
    // Handle the event data as needed
  });

  // Handle errors during the transaction process
  events.on('error', (error) => {
    console.error('An error occurred during the transaction:', error);
  });

  try {
    // Await the final transaction result
    const transactionInfo: VerifyTransactionInfo = await transactionResult;

    // Log the final transaction result
    console.log('Transaction completed successfully:', transactionInfo);
  } catch (error) {
    // Handle any errors that occurred during the transaction
    console.error('Transaction failed:', error);
  } finally {
    // Close the session when done
    await session.close();
  }
}

// Replace these variables with actual proof data
const proof = /* Your proof data */;
const publicSignals = /* Your public signals */;
const vk = /* Your verification key */;

// Execute the transaction
executeVerificationTransaction(proof, publicSignals, vk);
```

## API Reference

### `zkVerifySession.start`

```typescript
await zkVerifySession.start()
        .Testnet() // 1. Either preconfigured network selection
        .Custom('wss://custom') // 2. Or specify a custom network selection
        .withAccount(process.env.SEED_PHRASE!) // Optional
        .withWallet({
          source: selectedWallet,
          accountAddress: selectedAccount,
        }) // Optional
        .readOnly() // Optional
```

* Network Selection: Preconfigured options such as `.Testnet()` or provide your own websocket url using `.Custom('wss://custom')`.
* withAccount : Create a full session with ability send transactions get account info by using .withAccount('seed-phrase') and specifying your own seed phrase, cannot be used with `withWallet()`.
* withWallet : Establish connection to a browser extension based substrate wallet like talisman or subwallet, cannot be used with `withAccount()`;
* readOnly: Start the session in read-only mode, unable to send transactions or retrieve account info.

### `zkVerifySession.close`

```typescript
await session.close();
```

* Closes the zkVerifySession.

### `zkVerifySession.verify`

```typescript
const { events, transactionResult } = await session.verify()
        .fflonk()
        .nonce(1)
        .waitForPublishedAttestation()
        .withRegisteredVk()
        .execute({ proofData: {
            vk: vk,
            proof: proof,
            publicSignals: publicSignals }
        });; // 1. Directly pass proof data
        // .execute({ extrinsic: submittableExtrinsic }); // 2. OR pass in a pre-built SubmittableExtrinsic

```

* Proof Type: `.fflonk()` specifies the type of proof to be used. Options available for all supported proof types.
* Nonce: `.nonce(1)` sets the nonce for the transaction. This is optional and can be omitted if not required.
* Attestation Option: `.waitForPublishedAttestation()` specifies that the transaction should wait for the attestation to be published before completing. This is optional.
* Registered Verification Key: `.withRegisteredVk()` indicates that the verification key being used is registered on the chain. This option is optional and defaults to false.
* Execute:  You can either send in the raw proof details using `{ proofData: ... }` or verify a prebuilt extrinsic `{ extrinsic: ... }`
* Returns: An object containing an EventEmitter for real-time events and a Promise that resolves with the final transaction result, including waiting for the `poe.NewElement` attestation confirmation if waitForPublishedAttestation is specified.

### `zkVerifySession.optimisticVerify`

```typescript
  const { success, message } = session.optimisticVerify()
          .risc0()
          .execute({ proofData: {
              vk: vk,
              proof: proof,
              publicSignals: publicSignals }
          });;
```

* Proof Type: `.risc0()` specifies the type of proof to be used. Options available for all supported proof types.
* Execute:  You can either send in the raw proof details using `{ proofData: ... }` or verify a prebuilt extrinsic `{ extrinsic: ... }`
* Returns: A result containing a boolean `success`.  If success is false the response will also contain a `message` with further details related to the failure.

### `zkVerifySession.registerVerificationKey`

```typescript
const { events, transactionResult } = await session.registerVerificationKey().fflonk().execute(vk);
```

* Proof Type: `.fflonk()` specifies the type of proof to be used. Options available for all supported proof types.
* Returns: A TransactionInfo object containing a statementHash  string.

### `zkVerifySession.poe` (Proof of Existence)

```typescript
const proofDetails = await session.poe(attestationId, leafDigest, blockHash);
```

* `attestationId`: A number representing the published attestation ID from which the proof path is to be retrieved.
* `leafDigest`: A string representing the leaf digest to be used in the proof path retrieval.
* `blockHash`: (Optional) A string representing the block hash at which the proof should be retrieved.
* Returns: A Promise that resolves to a `MerkleProof` object containing the proof path details.

### `zkVerifySession.format`

```typescript
const { formattedVk, formattedProof, formattedPubs } = await session.format(proofType, proof, publicSignals, vk, version, registeredVk);

```

* `proofType`: An enum value representing the type of proof being formatted (e.g., ProofType.groth16).
* `proof`: The proof data that needs to be formatted.
* `publicSignals`: The public signals associated with the proof, which are also formatted.
* `vk`: The verification key that may be either registered or unregistered, depending on the context.
* `version`: (Optional) the version of the proof type being used e.g. for risc0 it could be 'V1\_0'
* `registeredVk`: (Optional) A boolean indicating if the verification key is already registered.
* Returns: A Promise that resolves to a `FormattedProofData` object containing:
  * formattedVk: The formatted verification key.
  * formattedProof: The formatted proof data.
  * formattedPubs: The formatted public signals.

### `zkVerifySession.createSubmitProofExtrinsic`

```shell
const extrinsic = await session.createSubmitProofExtrinsic(proofType, params);
```

* `proofType`: ProofType enum - used to obtain the name of the pallet that contains the proof submission method.
* `params`: A FormattedProofData object containing formatted proof parameters required for the extrinsic.
* Returns: A Promise that resolves to a `SubmittableExtrinsic<'promise'>`, allowing you to submit the proof to the blockchain.

### `zkVerifySession.createExtrinsicHex`

```shell
const hex = await session.createExtrinsicHex(proofType, params);
```

* `proofType`: ProofType enum - used to obtain the name of the pallet that contains the proof submission method.
* `params`: A FormattedProofData object of formatted proof parameters needed for the extrinsic.
* Returns: A Promise that resolves to a hex-encoded string representing the SubmittableExtrinsic.

### `zkVerifySession.createExtrinsicFromHex`

```shell
const extrinsic = await session.createExtrinsicFromHex(extrinsicHex);
```

* `extrinsicHex`: A string representing the hex-encoded SubmittableExtrinsic to be reconstructed.
* Returns: A Promise that resolves to a `SubmittableExtrinsic<'promise'>`, allowing you to interact with the reconstructed extrinsic.

### `zkVerifySession.estimateCost`

```shell
const extrinsic = await session.estimateCost(extrinsic);
```

* `extrinsic`: A submitProof SubmittableExtrinsic.
* Returns: A Promise that resolves to an ExtrinsicCostEstimate:
  ```
  partialFee: string;
  estimatedFeeInTokens: string;
  weight: string;
  length: number;
  ```

### `zkVerifySession.accountInfo`

```typescript
const accountInfo: AccountInfo = await session.accountInfo();
console.log(accountInfo.address);
console.log(accountInfo.nonce);
console.log(accountInfo.freeBalance);
console.log(accountInfo.reservedBalance);
```

* Returns account information: address, nonce, freeBalance and reservedBalance. Full session only, will not work in readOnly mode.

### `zkVerifySession.addAccount`

```typescript
session.addAccount(seedPhrase);
```

* `seedPhrase`: Your seed phrase as a string "my seed phrase"
* Adds the account to the current session

### `zkVerifySession.removeAccount`

```typescript
session.removeAccount();
```

* Removes the active account from the current session, does nothing if no account is currently active.

### `zkVerifySession.subscribeToNewAttestations`

```typescript
session.subscribeToNewAttestations(callback, attestationId);
```

* `callback`: A Function to be called whenever a NewAttestation event occurs. The function receives an AttestationEvent object as its argument.
* `attestationId`:  (Optional) A string representing the attestation ID to filter events by. If provided, the subscription will automatically unsubscribe after receiving the specified attestation event.

### `zkVerifySession.unsubscribe`

```typescript
session.unsubscribe();
```

* This method unsubscribes from any active NewAttestation event subscriptions. It is used to stop listening for NewAttestation events when they are no longer needed.

### `zkVerifySession.api`

```typescript
const api = session.api;
```

* Uses PolkadotJS 12.4.2
* Returns: The ApiPromise instance connected to the Polkadot.js API.
* This is the main API object used to interact with the blockchain. It provides methods for querying the chain state, submitting extrinsics, subscribing to events, and more.

### `zkVerifySession.provider`

```typescript
const provider = session.provider;
```

* Returns: The WsProvider instance connected to the WebSocket endpoint.
* The provider manages the connection to the blockchain node. It handles WebSocket communication and can be used to interact with the node directly, such as for subscribing to updates or making RPC calls.

### `zkVerifySession.account`

```typescript
const account = session.account;
```

* Returns: The KeyringPair object representing the active account in the session, or undefined if the session is in read-only mode.
* The account is used for signing transactions and interacting with the blockchain on behalf of the user. If no account is associated with the session (i.e., the session is in read-only mode), this will return undefined.
