import { describe, it, expect } from '@jest/globals';

// Plain CommonJS helper shared with the ESM pretest script.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  REFRESH_MARGIN_MS,
  decodeTcbInfo,
  shouldRefreshTcb,
  applyTcbResponse,
} = require('./tee-tcb.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;

const makeFixture = (nextUpdate: string) => {
  const tcbJson = JSON.stringify({
    tcbInfo: { issueDate: '2026-10-01T00:00:00Z', nextUpdate },
    signature: 'abc',
  });
  return {
    proof: '0x01',
    vk: {
      tcbResponse: '0x' + Buffer.from(tcbJson, 'utf8').toString('hex'),
      certificates: '0x02',
    },
  };
};

describe('refresh-tee-tcb helpers', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');

  it('decodes the embedded tcbInfo', () => {
    const info = decodeTcbInfo(makeFixture('2026-10-31T00:00:00Z'));
    expect(info).toEqual({
      issueDate: '2026-10-01T00:00:00Z',
      nextUpdate: '2026-10-31T00:00:00Z',
    });
  });

  it('does not refresh (and so does not touch the fixture or the network) while the TCB is valid', () => {
    const decision = shouldRefreshTcb(makeFixture('2026-10-31T00:00:00Z'), now);
    expect(decision.refresh).toBe(false);
    expect(decision.reason).toMatch(/valid until/);
  });

  it('refreshes once the TCB is within the expiry margin', () => {
    const soon = new Date(now + REFRESH_MARGIN_MS - 1).toISOString();
    expect(shouldRefreshTcb(makeFixture(soon), now).refresh).toBe(true);

    const comfortably = new Date(
      now + REFRESH_MARGIN_MS + DAY_MS,
    ).toISOString();
    expect(shouldRefreshTcb(makeFixture(comfortably), now).refresh).toBe(false);
  });

  it('refreshes an expired TCB', () => {
    const decision = shouldRefreshTcb(makeFixture('2026-10-01T00:00:00Z'), now);
    expect(decision.refresh).toBe(true);
    expect(decision.reason).toMatch(/expires at/);
  });

  it('refreshes when the fixture cannot be read', () => {
    expect(shouldRefreshTcb({}, now).refresh).toBe(true);
    expect(shouldRefreshTcb({ vk: { tcbResponse: '0xzz' } }, now).refresh).toBe(
      true,
    );
  });

  it('honours force', () => {
    const decision = shouldRefreshTcb(
      makeFixture('2099-01-01T00:00:00Z'),
      now,
      {
        force: true,
      },
    );
    expect(decision).toEqual({ refresh: true, reason: 'forced' });
  });

  it('applyTcbResponse replaces only tcbResponse and round-trips the JSON', () => {
    const fixture = makeFixture('2026-10-31T00:00:00Z');
    const fresh = JSON.stringify({
      tcbInfo: {
        issueDate: '2026-11-01T00:00:00Z',
        nextUpdate: '2026-12-01T00:00:00Z',
      },
    });

    const updated = applyTcbResponse(fixture, fresh);

    expect(updated.proof).toBe(fixture.proof);
    expect(updated.vk.certificates).toBe(fixture.vk.certificates);
    expect(decodeTcbInfo(updated)).toEqual({
      issueDate: '2026-11-01T00:00:00Z',
      nextUpdate: '2026-12-01T00:00:00Z',
    });
    // Input is not mutated.
    expect(decodeTcbInfo(fixture)?.nextUpdate).toBe('2026-10-31T00:00:00Z');
  });

  it('applyTcbResponse rejects a body that is not a TCB response', () => {
    expect(() =>
      applyTcbResponse(makeFixture('2026-10-31T00:00:00Z'), '{}'),
    ).toThrow(/does not contain tcbInfo/);
  });
});
