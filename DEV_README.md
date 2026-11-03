# zkVerifyJS Setup

## Pre-Requisities

1. Node 24.22.1+ (see `engines` in `package.json`)

```shell
ls-engines // Get minimum node version required for project based on dependencies.
```

```shell
ls-engines --save// Get minimum node version required for project based on dependencies and SAVE it to the package.json.
```

2. A `.env` file with funded Volta seed phrases for the integration tests. Copy `.env.template` and fill in `SEED_PHRASE_1` to `SEED_PHRASE_13`; the tests share them through a wallet pool, so more phrases give more parallelism.

```dotenv
SEED_PHRASE_1="MY SEED PHRASE WORDS GO HERE"
```

## Fresh Install

1. Build & install zkverifyjs pack, install dependencies

```shell
npm install && npm run pack-and-install
```

## Install Package Locally 

1. Deploy the package with latest code

```shell
npm run pack-and-install
```

2. Install the tgz in frontend project, renaming the tgz in the command below as necessary

```shell
npm install ./path-to-package/zkverifyjs-<version>.tgz
```

## Add New Proof Types

1. Update `src/config/index.ts`
2. Add a new proof to src/proofTypes including processor and formatter, and add export to `src/proofTypes/index.ts`
3. Adding new `SEED_PHRASE_*` environment variables will provide more throughput for tests if they are locked waiting for one to become available from the `WalletPool`

- Search for `ADD_NEW_PROOF_TYPE` in the codebase.

## Add New Supported Network

If we want to add a new configured network (e.g. mainnet)

1. Update `src/config/index.ts`

- Search for `ADD_NEW_SUPPORTED_NETWORK` in the codebase.

## Local GitHub Actions with Act

### Environment 

- Copy the `.env.template` into `.env` file and set the required values.

### Build & Test

```shell
act workflow_dispatch -j build-and-test -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest --network host
```

### Publish Package

```shell
act workflow_dispatch -j build-and-publish -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest --network host
```

## Run Tests

- Run a specific test
```shell
npx jest tests/verify.test.ts  
```

- Run all tests (unit and integration; the integration tests submit transactions to Volta)
```shell
npm run test
```

- The `pre-push` git hook runs `npm run build && npm test`, so pushing needs a funded `.env` and a reachable Volta node.

- Integration test cases are generated per runtime version of the connected network (`tests/common/runners.ts`). Proof types whose verifier pallet is disabled on Volta are skipped through `disabledProofTypes` in `tests/common/options.ts`.

## Test Coverage

- Run coverage for a specific file
```shell
npm run test:file:coverage src/api/connection  
```

- Run coverage for entire project
```shell
npm run test:coverage
```

## DOCS.md
The `DOCS.md` file gets generated from the README file on pre-commit automatically with husky, utilizing the `ci/generateDocsReadme.js` script. Do not edit `DOCS.md` directly. It will get overwritten.

This file is copied over and used in the [zkVerify docs](https://github.com/HorizenLabs/zkverify-docs). See: https://github.com/HorizenLabs/zkverify-docs/blob/main/scripts/github_readme.js