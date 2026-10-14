#!/usr/bin/env node

/**
 * Keeps the TEE test fixture's Intel TDX TCB info current.
 *
 * The TCB info expires roughly every 30 days. This runs as `pretest`, but only
 * rewrites the committed fixture when its data is expired or within a day of
 * expiring, so a routine test run is deterministic and does not need the network.
 * A fetch failure is a warning, never a test-suite failure.
 *
 * Usage:
 *   node tests/common/scripts/refresh-tee-tcb.mjs            # refresh only if stale
 *   FORCE_TEE_TCB_REFRESH=1 node tests/common/scripts/refresh-tee-tcb.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { get } from 'https';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { shouldRefreshTcb, applyTcbResponse } = require('./tee-tcb.cjs');

const __dirname = dirname(fileURLToPath(import.meta.url));

const TCB_URL =
  'https://api.trustedservices.intel.com/tdx/certification/v4/tcb?fmspc=B0C06F000000&update=standard';
const TEE_JSON_PATH = resolve(__dirname, '../data/tee_intel.json');

function fetchTcbInfo() {
  return new Promise((resolve, reject) => {
    get(TCB_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Intel TCB API returned status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

const teeData = JSON.parse(readFileSync(TEE_JSON_PATH, 'utf8'));
const force = process.env.FORCE_TEE_TCB_REFRESH === '1';
const decision = shouldRefreshTcb(teeData, Date.now(), { force });

if (!decision.refresh) {
  console.log(`TEE TCB fixture up to date (${decision.reason}); not refreshing.`);
  process.exit(0);
}

console.log(`Refreshing TEE TCB fixture (${decision.reason})...`);

try {
  const tcbJson = await fetchTcbInfo();
  const updated = applyTcbResponse(teeData, tcbJson);
  const parsed = JSON.parse(tcbJson);
  console.log(
    `TCB issueDate: ${parsed.tcbInfo.issueDate}, nextUpdate: ${parsed.tcbInfo.nextUpdate}`,
  );
  writeFileSync(TEE_JSON_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Updated ${TEE_JSON_PATH}`);
} catch (error) {
  console.warn(
    `WARNING: could not refresh TEE TCB fixture (${error instanceof Error ? error.message : String(error)}). ` +
      `Continuing with the committed fixture; TEE tests may fail if it has expired.`,
  );
}
