#!/usr/bin/env node

/**
 * Fetches fresh Intel TDX TCB info and updates the TEE test fixture.
 *
 * The TCB info expires roughly every 30 days, so this script should be run
 * before TEE integration tests to ensure the fixture data is current.
 *
 * Usage: node tests/common/scripts/refresh-tee-tcb.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { get } from 'https';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TCB_URL =
  'https://api.trustedservices.intel.com/tdx/certification/v4/tcb?fmspc=B0C06F000000&update=standard';
const TEE_JSON_PATH = resolve(__dirname, '../data/tee.json');

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

const tcbJson = await fetchTcbInfo();
const parsed = JSON.parse(tcbJson);

console.log(
  `TCB issueDate: ${parsed.tcbInfo.issueDate}, nextUpdate: ${parsed.tcbInfo.nextUpdate}`,
);

const tcbHex = '0x' + Buffer.from(tcbJson, 'utf8').toString('hex');

const teeData = JSON.parse(readFileSync(TEE_JSON_PATH, 'utf8'));
teeData.vk.tcbResponse = tcbHex;
writeFileSync(TEE_JSON_PATH, JSON.stringify(teeData, null, 2) + '\n');

console.log(`Updated ${TEE_JSON_PATH}`);
