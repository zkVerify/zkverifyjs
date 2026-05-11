#!/usr/bin/env node

/**
 * Sends live `.execute()` transactions and writes a heap snapshot for cleanup
 * diagnostics.
 *
 * Requirements:
 * - A funded SEED_PHRASE* value in the repo .env file, or set ZKV_HEAP_DOTENV.
 * - Run with --expose-gc so the script can force GC before snapshotting.
 *
 * Example:
 *   node --expose-gc tests/common/scripts/live-execute-heap.cjs \
 *     --label=fixed-live-race --count=1 --force-late-unsubscribe=true
 *
 * Heap snapshots are written to tmp/ by default, which is gitignored.
 */

const fs = require('fs');
const path = require('path');
const v8 = require('v8');

process.env.TS_NODE_COMPILER_OPTIONS ??= JSON.stringify({
  module: 'commonjs',
});
require('ts-node/register/transpile-only');

require('dotenv').config({
  path:
    process.env.ZKV_HEAP_DOTENV ||
    path.resolve(__dirname, '..', '..', '..', '.env'),
});

const {
  zkVerifySession,
  ProofType,
  Library,
  CurveType,
  ZkVerifyEvents,
} = require('../../../src');

const proofData = require('../data/groth16_snarkjs_bn254.json');

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const label = args.get('label') || 'execute-heap';
const txCount = Number(args.get('count') || 1);
const unsubscribeDelayMs = Number(args.get('unsubscribe-delay-ms') || 500);
const forceLateUnsubscribe = args.get('force-late-unsubscribe') !== 'false';
const showTxHashes = args.get('show-tx-hashes') === 'true';
const outDir = path.resolve(
  args.get('out-dir') ||
    path.join(process.cwd(), 'tmp', 'live-execute-heap'),
);

let unsubscribeFunctionsDelivered = 0;
let unsubscribeFunctionsInvoked = 0;

function firstSeedPhrase() {
  const entry = Object.entries(process.env).find(
    ([key, value]) =>
      key.startsWith('SEED_PHRASE') &&
      typeof value === 'string' &&
      value.trim().split(/\s+/).length === 12,
  );

  if (!entry) {
    throw new Error('No valid SEED_PHRASE* value found for live heap run.');
  }

  return entry[1];
}

function forceGc(rounds = 5) {
  if (typeof global.gc !== 'function') {
    throw new Error('Run node with --expose-gc for heap diagnostics.');
  }

  for (let i = 0; i < rounds; i += 1) {
    global.gc();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function instrumentSignAndSendUnsubscribe(extrinsic) {
  const original = extrinsic.signAndSend.bind(extrinsic);

  extrinsic.signAndSend = (...signAndSendArgs) => {
    let finalizedSeen = false;
    let finalizedResolve;
    const finalizedPromise = new Promise((resolve) => {
      finalizedResolve = resolve;
    });
    const callbackIndex = signAndSendArgs.length - 1;
    const originalCallback = signAndSendArgs[callbackIndex];

    if (typeof originalCallback === 'function') {
      signAndSendArgs[callbackIndex] = async (result) => {
        try {
          await originalCallback(result);
        } finally {
          if (result?.status?.isFinalized && !finalizedSeen) {
            finalizedSeen = true;
            finalizedResolve();
          }
        }
      };
    }

    const result = original(...signAndSendArgs);

    const wrapUnsubscribe = async (unsubscribe) => {
      if (forceLateUnsubscribe) {
        await finalizedPromise;
      }
      await delay(unsubscribeDelayMs);

      unsubscribeFunctionsDelivered += 1;
      return () => {
        unsubscribeFunctionsInvoked += 1;
        return unsubscribe();
      };
    };

    if (result && typeof result.then === 'function') {
      return result.then(wrapUnsubscribe);
    }

    if (typeof result === 'function') {
      return wrapUnsubscribe(result);
    }

    return result;
  };

  return extrinsic;
}

async function sendOne(session, index) {
  const proofOptions = {
    proofType: ProofType.groth16,
    config: { library: Library.snarkjs, curve: CurveType.bn254 },
  };

  const formatted = await session.format(
    proofOptions,
    proofData.proof,
    proofData.publicSignals,
    proofData.vk,
  );

  const extrinsic = instrumentSignAndSendUnsubscribe(
    await session.createSubmitProofExtrinsic(ProofType.groth16, formatted),
  );

  const { events, transactionResult } = await session
    .verify()
    .groth16({ library: Library.snarkjs, curve: CurveType.bn254 })
    .execute({ extrinsic });

  events.on(ZkVerifyEvents.Broadcast, ({ txHash }) => {
    console.log(
      `[${label}] tx ${index} broadcast${showTxHashes ? ` ${txHash}` : ''}`,
    );
  });
  events.on(ZkVerifyEvents.Finalized, ({ txHash, blockHash }) => {
    console.log(
      `[${label}] tx ${index} finalized${
        showTxHashes ? ` ${txHash} ${blockHash}` : ''
      }`,
    );
  });
  events.on(ZkVerifyEvents.ErrorEvent, (error) => {
    console.error(`[${label}] tx ${index} error`, error);
  });

  const result = await transactionResult;
  events.removeAllListeners();
  return result.txHash;
}

function analyzeSnapshot(snapshotPath) {
  const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const meta = data.snapshot.meta;
  const nodeFields = meta.node_fields;
  const edgeFields = meta.edge_fields;
  const nodeTypes = meta.node_types[0];
  const edgeTypes = meta.edge_types[0];
  const nodeIndex = Object.fromEntries(nodeFields.map((field, i) => [field, i]));
  const edgeIndex = Object.fromEntries(edgeFields.map((field, i) => [field, i]));
  const nodeStride = nodeFields.length;
  const edgeStride = edgeFields.length;
  const { nodes, edges, strings } = data;
  const nodeCount = nodes.length / nodeStride;

  const edgeStarts = new Array(nodeCount + 1);
  let edgeOffset = 0;
  for (let i = 0; i < nodeCount; i += 1) {
    edgeStarts[i] = edgeOffset;
    edgeOffset += nodes[i * nodeStride + nodeIndex.edge_count] * edgeStride;
  }
  edgeStarts[nodeCount] = edgeOffset;

  const analysis = {
    handleTransactionContexts: 0,
    cancelTransactionClosures: 0,
    finalizeTransactionClosures: 0,
  };

  for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
    const nodeOffset = nodeId * nodeStride;
    const nodeType = nodeTypes[nodes[nodeOffset + nodeIndex.type]];
    const nodeName = strings[nodes[nodeOffset + nodeIndex.name]];

    if (nodeType === 'closure' && nodeName === 'cancelTransaction') {
      analysis.cancelTransactionClosures += 1;
    }
    if (nodeType === 'closure' && nodeName === 'finalizeTransaction') {
      analysis.finalizeTransactionClosures += 1;
    }
    if (nodeType !== 'object' || nodeName !== 'system / Context') {
      continue;
    }

    const contextEdgeNames = new Set();
    for (
      let currentEdge = edgeStarts[nodeId];
      currentEdge < edgeStarts[nodeId + 1];
      currentEdge += edgeStride
    ) {
      const edgeType = edgeTypes[edges[currentEdge + edgeIndex.type]];
      if (edgeType !== 'context') continue;

      contextEdgeNames.add(strings[edges[currentEdge + edgeIndex.name_or_index]]);
    }

    if (
      contextEdgeNames.has('unsubscribeFn') &&
      contextEdgeNames.has('cancelTransaction') &&
      contextEdgeNames.has('finalizeTransaction')
    ) {
      analysis.handleTransactionContexts += 1;
    }
  }

  return analysis;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const seedPhrase = firstSeedPhrase();
  const session = await zkVerifySession.start().Volta().withAccount(seedPhrase);
  const txHashes = [];

  try {
    for (let i = 1; i <= txCount; i += 1) {
      txHashes.push(await sendOne(session, i));
    }

    await delay(unsubscribeDelayMs + 500);
    forceGc();

    const snapshotPath = v8.writeHeapSnapshot(
      path.join(outDir, `${label}.heapsnapshot`),
    );

    console.log(
      JSON.stringify(
        {
          label,
          txCount,
          forceLateUnsubscribe,
          snapshotPath,
          txHashes: showTxHashes ? txHashes : undefined,
          unsubscribeFunctionsDelivered,
          unsubscribeFunctionsInvoked,
          analysis: analyzeSnapshot(snapshotPath),
        },
        null,
        2,
      ),
    );
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
