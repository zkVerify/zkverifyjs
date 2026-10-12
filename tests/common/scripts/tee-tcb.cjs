'use strict';

/**
 * Pure helpers for the TEE TCB fixture refresh, kept free of I/O so they can be
 * unit-tested without touching the network or the fixture on disk.
 */

/** Refresh when the fixture's `nextUpdate` is closer than this (ms). */
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/** Upper bound on an accepted TCB response body (bytes). */
const MAX_TCB_RESPONSE_BYTES = 256 * 1024;

/**
 * Decodes the `tcbInfo` JSON embedded (hex-encoded) in a TEE fixture.
 *
 * @param {{ vk?: { tcbResponse?: string } }} fixture
 * @returns {{ issueDate?: string, nextUpdate?: string } | undefined}
 */
function decodeTcbInfo(fixture) {
  const hex = fixture && fixture.vk && fixture.vk.tcbResponse;
  if (typeof hex !== 'string' || !hex.startsWith('0x')) {
    return undefined;
  }
  try {
    const json = Buffer.from(hex.slice(2), 'hex').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed.tcbInfo : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Decides whether the committed fixture must be refreshed from Intel.
 *
 * The fixture is only rewritten when its TCB info is expired or about to expire,
 * so a routine `npm test` is deterministic and works offline while the committed
 * data is still valid. `force` bypasses the check.
 *
 * @param {object} fixture - Parsed fixture JSON.
 * @param {number} nowMs - Current time in ms since the epoch.
 * @param {{ force?: boolean }} [options]
 * @returns {{ refresh: boolean, reason: string }}
 */
function shouldRefreshTcb(fixture, nowMs, options = {}) {
  if (options.force) {
    return { refresh: true, reason: 'forced' };
  }

  const info = decodeTcbInfo(fixture);
  const nextUpdate = info && Date.parse(info.nextUpdate);

  if (!Number.isFinite(nextUpdate)) {
    return { refresh: true, reason: 'fixture has no readable nextUpdate' };
  }

  if (nextUpdate - nowMs <= REFRESH_MARGIN_MS) {
    return {
      refresh: true,
      reason: `fixture TCB expires at ${new Date(nextUpdate).toISOString()}`,
    };
  }

  return {
    refresh: false,
    reason: `fixture TCB valid until ${new Date(nextUpdate).toISOString()}`,
  };
}

/**
 * Returns a copy of `fixture` with `tcbResponse` replaced by the hex-encoding of
 * `tcbJson`. Throws if `tcbJson` is not a TCB response.
 *
 * @param {object} fixture
 * @param {string} tcbJson - Raw JSON body from the Intel TCB API.
 */
function applyTcbResponse(fixture, tcbJson) {
  if (typeof tcbJson !== 'string') {
    throw new Error('TCB response must be a string');
  }
  if (Buffer.byteLength(tcbJson, 'utf8') > MAX_TCB_RESPONSE_BYTES) {
    throw new Error('TCB response exceeds the maximum accepted size');
  }
  const parsed = JSON.parse(tcbJson);
  const info = parsed && typeof parsed === 'object' ? parsed.tcbInfo : undefined;
  if (!info || typeof info !== 'object') {
    throw new Error('TCB response does not contain tcbInfo');
  }
  for (const field of ['issueDate', 'nextUpdate']) {
    if (typeof info[field] !== 'string' || !Number.isFinite(Date.parse(info[field]))) {
      throw new Error(`TCB response has an invalid tcbInfo.${field}`);
    }
  }
  if (typeof parsed.signature !== 'string' || !/^[0-9a-fA-F]+$/.test(parsed.signature)) {
    throw new Error('TCB response has an invalid signature');
  }
  return {
    ...fixture,
    vk: {
      ...fixture.vk,
      tcbResponse: '0x' + Buffer.from(tcbJson, 'utf8').toString('hex'),
    },
  };
}

module.exports = {
  REFRESH_MARGIN_MS,
  MAX_TCB_RESPONSE_BYTES,
  decodeTcbInfo,
  shouldRefreshTcb,
  applyTcbResponse,
};
