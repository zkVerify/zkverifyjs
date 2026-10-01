# Security Policy

## Supported versions

Security fixes are published for the latest minor release line of `zkverifyjs`.
Older lines receive fixes only for critical issues.

| Version | Supported          |
| ------- | ------------------ |
| 3.3.x   | :white_check_mark: |
| < 3.3   | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately through either channel:

- **GitHub private vulnerability reporting** — use the
  [Report a vulnerability](https://github.com/zkVerify/zkverifyjs/security/advisories/new)
  button on the Security tab. This is the preferred route, since it keeps the
  discussion attached to the repository.
- **Email** — <web3-platform@zkverify.io>.

Please include, as far as you are able:

- the affected version(s) and the platform/runtime you observed it on;
- a description of the issue and its impact;
- reproduction steps or a proof-of-concept;
- any suggested remediation.

### What to expect

- **Acknowledgement** within 3 working days.
- **Initial assessment**, including a severity judgement, within 10 working days.
- **Progress updates** at least every 10 working days until resolution.
- **Credit** in the release notes and advisory, unless you prefer to remain anonymous.

Please give us a reasonable opportunity to ship a fix before disclosing publicly.

## Scope

This policy covers the `zkverifyjs` package in this repository: the published npm
artifact, its build and release pipeline, and the source in `src/`.

Especially in scope:

- key handling — seed phrases, `KeyringPair` lifecycle, account derivation;
- transaction construction and signing, including replay exposure;
- proof, verification-key, and public-signal encoding, where a defect could cause a
  payload other than the one the caller intended to be submitted on-chain;
- endpoint handling and transport security for `Custom` network configuration;
- supply-chain integrity of the release pipeline.

Out of scope for this repository (report to the relevant project instead):

- the zkVerify chain, runtime, and pallets;
- `@polkadot/*` libraries and other upstream dependencies — though please do tell us if
  `zkverifyjs` uses one in an unsafe way, or pins a vulnerable version;
- vulnerabilities requiring a compromised local machine or a malicious dependency
  already present in the consumer's own tree.

## Notes for consumers

- **Custom endpoints.** `zkVerifySession.start().Custom({...})` warns when given an
  unencrypted `ws://` endpoint on a non-loopback host. Over a plaintext connection a
  network-position attacker controls the chain state this SDK reports as authoritative,
  including proof verification results. Prefer `wss://`; set
  `allowInsecureWebSocket: true` to silence the warning only on a trusted private
  network you control.
- **`optimisticVerify` transmits a signed payload.** `system.dryRun` verifies
  signatures, so optimistic verification signs a real extrinsic and sends it to the RPC
  endpoint. It is signed with a short mortal era so it expires within a few blocks,
  but treat the endpoint you dry-run against as trusted.
- **Seed phrases stay in memory.** Accounts added to a session are held as
  `KeyringPair`s for the lifetime of the session. Call `session.close()` when done, and
  never pass a mainnet mnemonic to a session pointed at an untrusted endpoint.
