'use strict';

/**
 * Pure helpers for the TEE TCB fixture refresh, kept free of I/O so they can be
 * unit-tested without touching the network or the fixture on disk.
 */

/** Refresh when the fixture's `nextUpdate` is closer than this (ms). */
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

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
  const parsed = JSON.parse(tcbJson);
  if (!parsed || typeof parsed !== 'object' || !parsed.tcbInfo) {
    throw new Error('TCB response does not contain tcbInfo');
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
  decodeTcbInfo,
  shouldRefreshTcb,
  applyTcbResponse,
};
