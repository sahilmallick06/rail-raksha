import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QuotaAndCacheStore } from './quotaStore.ts';

describe('RailRadar Quota & Cache Safeguards', () => {
  it('enforces daily limit (12), pre-call counting, and duplicate suppression', () => {
    const t0 = new Date('2026-11-20T10:00:00Z');
    const store = new QuotaAndCacheStore({ now: t0, filePath: null });

    // No API key -> always blocked
    const noKey = store.canCallExternal('22416', false, t0);
    assert.equal(noKey.allowed, false);

    // Reserve first call
    assert.equal(store.canCallExternal('22416', true, t0).allowed, true);
    store.reserveQuotaCall('22416', t0);

    // Duplicate call within 15s is suppressed
    const tDup = new Date(t0.getTime() + 5000);
    const dupCheck = store.canCallExternal('22416', true, tDup);
    assert.equal(dupCheck.allowed, false);
    assert.equal(store.getQuotaStatus(true, tDup).totalSuppressedDuplicates, 1);

    // Exhaust remaining 11 calls on distinct trains
    for (let i = 0; i < 11; i++) {
      const tn = `1200${i}`;
      assert.equal(store.canCallExternal(tn, true, tDup).allowed, true);
      store.reserveQuotaCall(tn, tDup);
    }

    const q = store.getQuotaStatus(true, tDup);
    assert.equal(q.dailyUsed, 12);
    assert.equal(q.dailyRemaining, 0);
    assert.equal(store.canCallExternal('99999', true, tDup).allowed, false);
  });

  it('enforces 1-hour HTTP 429 cooldown and max 3 trains per fleet refresh', () => {
    const t0 = new Date('2026-11-20T10:00:00Z');
    const store = new QuotaAndCacheStore({ now: t0, filePath: null });

    const batch = store.validateFleetBatch(['22416', '20818', '12306', '12302', '12002']);
    assert.equal(batch.accepted.length, 3);
    assert.equal(batch.rejectedOverflow.length, 2);

    store.trigger429Cooldown(t0);
    const duringCooldown = new Date(t0.getTime() + 20 * 60_000);
    assert.equal(store.canCallExternal('22416', true, duringCooldown).allowed, false);
    assert.equal(store.getQuotaStatus(true, duringCooldown).cooldownActive, true);

    const afterCooldown = new Date(t0.getTime() + 61 * 60_000);
    assert.equal(store.canCallExternal('22416', true, afterCooldown).allowed, true);
  });

  it('supports fresh 30-min cache, stale 7-day reuse, watchlist CRUD, and decision history', () => {
    const t0 = new Date('2026-11-20T10:00:00Z');
    const store = new QuotaAndCacheStore({ now: t0, filePath: null });

    const fresh = store.getCachedSnapshot('22416', new Date(t0.getTime() + 10 * 60_000));
    assert.ok(fresh.snapshot);
    assert.equal(fresh.isFresh, true);

    const stale = store.getCachedSnapshot('22416', new Date(t0.getTime() + 45 * 60_000));
    assert.equal(stale.isFresh, false);
    assert.equal(stale.withinStaleWindow, true);

    const added = store.addToWatchlist('12952', 'Mumbai Tejas Rajdhani', t0);
    assert.ok(added.includes('12952'));
    const removed = store.removeFromWatchlist('12952');
    assert.ok(!removed.includes('12952'));

    store.recordDecision({
      id: 'DEC-1',
      replayId: 'RPL-1',
      timestamp: t0.toISOString(),
      conflictId: 'INC-22416-20818',
      trainPair: '22416 -> 20818',
      planId: 'PLAN-OPT',
      planVersion: 'v2.4-advisory',
      planName: 'RailRaksha AI Advisory',
      decision: 'ACCEPTED_FOR_SIMULATION',
      controllerNote: 'Approved speed trim for viva check',
      reasonCode: 'HEADWAY_PROTECTION',
      beforeMetrics: { minGapM: 36, minTtcS: 2.1, activeConflicts: 1, totalDelayMin: 60 },
      afterMetrics: { minGapM: 145, minTtcS: 38.5, activeConflicts: 0, totalDelayMin: 63 },
      provenance: 'CONTROLLER_DECISION',
    });
    assert.equal(store.getDecisions().length, 1);
  });
});
