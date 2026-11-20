import fs from 'node:fs';
import path from 'node:path';
import type {
  DecisionRecord,
  LiveTrainSnapshot,
  QuotaStatus,
  StationStop,
} from '../types/railraksha.ts';

export interface QuotaConfig {
  dailyLimit: number;
  monthlyLimit: number;
  maxFleetRefreshTrains: number;
  freshCacheMinutes: number;
  staleCacheDays: number;
  cooldownMinutes429: number;
  dedupeWindowMs: number;
}

export const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  dailyLimit: 12,
  monthlyLimit: 240,
  maxFleetRefreshTrains: 3,
  freshCacheMinutes: 30,
  staleCacheDays: 7,
  cooldownMinutes429: 60,
  dedupeWindowMs: 15_000,
};

interface PersistedState {
  dayKey: string;
  monthKey: string;
  dailyUsed: number;
  monthlyUsed: number;
  cooldownUntil: string | null;
  lastExternalCallAt: string | null;
  totalCacheHits: number;
  totalSuppressedDuplicates: number;
  watchlist: string[];
  snapshots: Record<string, LiveTrainSnapshot>;
  decisions: DecisionRecord[];
}

function buildSeededTimeline(
  originCode: string,
  originName: string,
  midStations: Array<{ code: string; name: string; sched: string; distKm: number }>,
  destCode: string,
  destName: string,
  destSched: string,
  passedIdx: number,
  delayMin: number | null
): StationStop[] {
  const stops: StationStop[] = [
    {
      stationCode: originCode,
      stationName: originName,
      scheduledArrival: null,
      scheduledDeparture: midStations[0]?.sched ? 'Origin Dep' : 'Scheduled',
      reportedArrival: null,
      reportedDeparture: delayMin !== null ? 'Departed' : null,
      delayMin: delayMin !== null ? Math.max(0, Math.round(delayMin * 0.4)) : null,
      distanceKm: 0,
      status: 'PASSED',
    },
  ];

  midStations.forEach((st, idx) => {
    const status: StationStop['status'] =
      idx < passedIdx ? 'PASSED' : idx === passedIdx ? 'CURRENT' : 'UPCOMING';
    stops.push({
      stationCode: st.code,
      stationName: st.name,
      scheduledArrival: st.sched,
      scheduledDeparture: st.sched,
      reportedArrival:
        status === 'PASSED' || status === 'CURRENT'
          ? st.sched
          : null,
      reportedDeparture: status === 'PASSED' ? st.sched : null,
      delayMin: status === 'UPCOMING' ? delayMin : delayMin,
      distanceKm: st.distKm,
      status,
    });
  });

  stops.push({
    stationCode: destCode,
    stationName: destName,
    scheduledArrival: destSched,
    scheduledDeparture: null,
    reportedArrival: null,
    reportedDeparture: null,
    delayMin,
    distanceKm: (midStations[midStations.length - 1]?.distKm ?? 400) + 180,
    status: 'UPCOMING',
  });

  return stops;
}

export function createSeededCachedSnapshots(nowIso: string): Record<string, LiveTrainSnapshot> {
  const mk = (
    trainNo: string,
    trainName: string,
    originCode: string,
    originName: string,
    destinationCode: string,
    destinationName: string,
    lastCode: string | null,
    lastName: string | null,
    nextCode: string | null,
    nextName: string | null,
    scheduledEta: string | null,
    reportedEta: string | null,
    delayMinutes: number | null,
    corridorTrainId: string | null,
    midStations: Array<{ code: string; name: string; sched: string; distKm: number }>,
    passedIdx: number
  ): LiveTrainSnapshot => {
    const runningStatus: LiveTrainSnapshot['runningStatus'] =
      delayMinutes === null
        ? 'STATUS_UNAVAILABLE'
        : delayMinutes >= 5
          ? 'DELAYED'
          : 'ON_TIME';

    return {
      trainNo,
      trainName,
      originCode,
      originName,
      destinationCode,
      destinationName,
      lastReportedStationCode: lastCode,
      lastReportedStationName: lastName,
      nextScheduledStationCode: nextCode,
      nextScheduledStationName: nextName,
      scheduledEta,
      reportedEta,
      delayMinutes,
      runningStatus,
      lastUpdatedAt: nowIso,
      fetchedFromExternalAt: null,
      cacheAgeMinutes: 0,
      isStale: false,
      provenance: 'CACHED',
      sourceLabel: 'Cached Reference Snapshot (No Live Call Used)',
      inWatchlist: true,
      corridorTrainId,
      stationTimeline: buildSeededTimeline(
        originCode,
        originName,
        midStations,
        destinationCode,
        destinationName,
        scheduledEta ?? 'Not available',
        passedIdx,
        delayMinutes
      ),
      historicalObservations: [
        {
          observedAt: nowIso,
          stationCode: lastCode ?? originCode,
          stationName: lastName ?? originName,
          delayMin: delayMinutes,
          source: 'CACHED',
          note: 'Baseline cached observation loaded for zero-quota startup & viva reliability.',
        },
      ],
      unavailableFieldsNote:
        'Live track-circuit coordinates, signal aspect, and physical inter-train meter gap are NOT supplied by RailRadar/external running-status APIs.',
    };
  };

  const list: LiveTrainSnapshot[] = [
    mk(
      '22416',
      'Varanasi Vande Bharat Express',
      'NDLS',
      'New Delhi',
      'BSB',
      'Varanasi Jn',
      'GZB',
      'Ghaziabad Jn',
      'CNB',
      'Kanpur Central',
      '19:08',
      '19:19',
      11,
      'T02',
      [
        { code: 'GZB', name: 'Ghaziabad Jn', sched: '15:32', distKm: 26 },
        { code: 'CNB', name: 'Kanpur Central', sched: '19:08', distKm: 440 },
        { code: 'PRYJ', name: 'Prayagraj Jn', sched: '21:11', distKm: 635 },
      ],
      0
    ),
    mk(
      '20818',
      'Bhubaneswar Tejas Rajdhani',
      'NDLS',
      'New Delhi',
      'BBS',
      'Bhubaneswar',
      'GZB',
      'Ghaziabad Jn',
      'CNB',
      'Kanpur Central',
      '21:55',
      '21:59',
      4,
      'T01',
      [
        { code: 'GZB', name: 'Ghaziabad Jn', sched: '17:34', distKm: 26 },
        { code: 'CNB', name: 'Kanpur Central', sched: '21:55', distKm: 440 },
        { code: 'DDU', name: 'Pt DD Upadhyaya Jn', sched: '01:52', distKm: 787 },
      ],
      0
    ),
    mk(
      '22439',
      'SMVD Katra Vande Bharat Express',
      'NDLS',
      'New Delhi',
      'SVDK',
      'SMVD Katra',
      'UMB',
      'Ambala Cantt Jn',
      'LDH',
      'Ludhiana Jn',
      '09:19',
      '09:19',
      0,
      'T03',
      [
        { code: 'UMB', name: 'Ambala Cantt Jn', sched: '08:10', distKm: 198 },
        { code: 'LDH', name: 'Ludhiana Jn', sched: '09:19', distKm: 312 },
        { code: 'JAT', name: 'Jammu Tawi', sched: '12:38', distKm: 577 },
      ],
      0
    ),
    mk(
      '12002',
      'Rani Kamalapati Shatabdi Express',
      'NDLS',
      'New Delhi',
      'RKMP',
      'Rani Kamalapati',
      'AGC',
      'Agra Cantt',
      'GWL',
      'Gwalior Jn',
      '09:23',
      '09:26',
      3,
      'T04',
      [
        { code: 'MTJ', name: 'Mathura Jn', sched: '07:22', distKm: 141 },
        { code: 'AGC', name: 'Agra Cantt', sched: '07:57', distKm: 195 },
        { code: 'GWL', name: 'Gwalior Jn', sched: '09:23', distKm: 313 },
      ],
      1
    ),
    mk(
      '12306',
      'Kolkata Rajdhani Express',
      'NDLS',
      'New Delhi',
      'HWH',
      'Howrah Jn',
      'CNB',
      'Kanpur Central',
      'PRYJ',
      'Prayagraj Jn',
      '23:43',
      '00:01',
      18,
      'T05',
      [
        { code: 'CNB', name: 'Kanpur Central', sched: '21:37', distKm: 440 },
        { code: 'PRYJ', name: 'Prayagraj Jn', sched: '23:43', distKm: 635 },
        { code: 'PNBE', name: 'Patna Jn', sched: '04:50', distKm: 1000 },
      ],
      0
    ),
    mk(
      '12302',
      'Howrah Rajdhani Express (Via Gaya)',
      'NDLS',
      'New Delhi',
      'HWH',
      'Howrah Jn',
      'ALJN',
      'Aligarh Jn',
      'CNB',
      'Kanpur Central',
      '21:37',
      '21:46',
      9,
      'T06',
      [
        { code: 'ALJN', name: 'Aligarh Jn', sched: '18:24', distKm: 126 },
        { code: 'CNB', name: 'Kanpur Central', sched: '21:37', distKm: 440 },
        { code: 'GAYA', name: 'Gaya Jn', sched: '03:55', distKm: 997 },
      ],
      0
    ),
    mk(
      '22824',
      'Bhubaneswar Tejas Rajdhani (Via Tatanagar)',
      'NDLS',
      'New Delhi',
      'BBS',
      'Bhubaneswar',
      'CNB',
      'Kanpur Central',
      'PRYJ',
      'Prayagraj Jn',
      '23:55',
      '23:57',
      2,
      'T07',
      [
        { code: 'CNB', name: 'Kanpur Central', sched: '21:47', distKm: 440 },
        { code: 'PRYJ', name: 'Prayagraj Jn', sched: '23:55', distKm: 635 },
        { code: 'TATA', name: 'Tatanagar Jn', sched: '10:35', distKm: 1388 },
      ],
      0
    ),
    mk(
      '12951',
      'Mumbai Central–New Delhi Tejas Rajdhani',
      'MMCT',
      'Mumbai Central',
      'NDLS',
      'New Delhi',
      'KOTA',
      'Kota Jn',
      'NDLS',
      'New Delhi',
      '08:32',
      '08:38',
      6,
      null,
      [
        { code: 'ST', name: 'Surat', sched: '19:43', distKm: 263 },
        { code: 'BRC', name: 'Vadodara Jn', sched: '21:06', distKm: 392 },
        { code: 'KOTA', name: 'Kota Jn', sched: '03:15', distKm: 920 },
      ],
      2
    ),
  ];

  const out: Record<string, LiveTrainSnapshot> = {};
  for (const item of list) {
    out[item.trainNo] = item;
  }
  return out;
}

function getDateKeys(now: Date) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return { dayKey: `${y}-${m}-${d}`, monthKey: `${y}-${m}` };
}

export class QuotaAndCacheStore {
  private config: QuotaConfig;
  private filePath: string | null;
  private state: PersistedState;
  private recentRequests = new Map<string, number>();

  constructor(options?: {
    config?: Partial<QuotaConfig>;
    filePath?: string | null;
    now?: Date;
  }) {
    this.config = { ...DEFAULT_QUOTA_CONFIG, ...(options?.config ?? {}) };
    this.filePath = options?.filePath ?? null;
    const now = options?.now ?? new Date();
    this.state = this.loadOrInit(now);
  }

  private loadOrInit(now: Date): PersistedState {
    const keys = getDateKeys(now);
    const defaultSnapshots = createSeededCachedSnapshots(now.toISOString());
    const defaultWatchlist = Object.keys(defaultSnapshots);

    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(this.filePath, 'utf-8')
        ) as Partial<PersistedState>;
        const state: PersistedState = {
          dayKey: parsed.dayKey ?? keys.dayKey,
          monthKey: parsed.monthKey ?? keys.monthKey,
          dailyUsed: parsed.dailyUsed ?? 0,
          monthlyUsed: parsed.monthlyUsed ?? 0,
          cooldownUntil: parsed.cooldownUntil ?? null,
          lastExternalCallAt: parsed.lastExternalCallAt ?? null,
          totalCacheHits: parsed.totalCacheHits ?? 0,
          totalSuppressedDuplicates: parsed.totalSuppressedDuplicates ?? 0,
          watchlist:
            Array.isArray(parsed.watchlist) && parsed.watchlist.length > 0
              ? parsed.watchlist
              : defaultWatchlist,
          snapshots: {
            ...defaultSnapshots,
            ...(parsed.snapshots ?? {}),
          },
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        };
        this.rolloverPeriods(state, now);
        return state;
      } catch {
        // Corrupt file falls back cleanly to seeded state
      }
    }

    return {
      dayKey: keys.dayKey,
      monthKey: keys.monthKey,
      dailyUsed: 0,
      monthlyUsed: 0,
      cooldownUntil: null,
      lastExternalCallAt: null,
      totalCacheHits: 0,
      totalSuppressedDuplicates: 0,
      watchlist: defaultWatchlist,
      snapshots: defaultSnapshots,
      decisions: [],
    };
  }

  private rolloverPeriods(state: PersistedState, now: Date) {
    const { dayKey, monthKey } = getDateKeys(now);
    if (state.dayKey !== dayKey) {
      state.dayKey = dayKey;
      state.dailyUsed = 0;
    }
    if (state.monthKey !== monthKey) {
      state.monthKey = monthKey;
      state.monthlyUsed = 0;
    }
  }

  private persist() {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch {
      // Non-fatal persistence error
    }
  }

  public getQuotaStatus(railradarKeyConfigured: boolean, now = new Date()): QuotaStatus {
    this.rolloverPeriods(this.state, now);
    const cooldownActive =
      this.state.cooldownUntil !== null &&
      new Date(this.state.cooldownUntil).getTime() > now.getTime();
    if (!cooldownActive && this.state.cooldownUntil !== null) {
      this.state.cooldownUntil = null;
      this.persist();
    }

    return {
      railradarKeyConfigured,
      dailyLimit: this.config.dailyLimit,
      dailyUsed: this.state.dailyUsed,
      dailyRemaining: Math.max(0, this.config.dailyLimit - this.state.dailyUsed),
      monthlyLimit: this.config.monthlyLimit,
      monthlyUsed: this.state.monthlyUsed,
      monthlyRemaining: Math.max(
        0,
        this.config.monthlyLimit - this.state.monthlyUsed
      ),
      maxFleetRefreshTrains: this.config.maxFleetRefreshTrains,
      freshCacheMinutes: this.config.freshCacheMinutes,
      staleCacheDays: this.config.staleCacheDays,
      cooldownActive,
      cooldownUntil: cooldownActive ? this.state.cooldownUntil : null,
      lastExternalCallAt: this.state.lastExternalCallAt,
      totalCacheHits: this.state.totalCacheHits,
      totalSuppressedDuplicates: this.state.totalSuppressedDuplicates,
    };
  }

  public canCallExternal(
    trainNo: string,
    railradarKeyConfigured: boolean,
    now = new Date()
  ): { allowed: boolean; reason: string } {
    this.rolloverPeriods(this.state, now);

    if (!railradarKeyConfigured) {
      return {
        allowed: false,
        reason: 'RAILRADAR_API_KEY is not configured; serving cached snapshot.',
      };
    }

    if (
      this.state.cooldownUntil &&
      new Date(this.state.cooldownUntil).getTime() > now.getTime()
    ) {
      return {
        allowed: false,
        reason: `HTTP 429 cooldown active until ${this.state.cooldownUntil}.`,
      };
    }

    if (this.state.dailyUsed >= this.config.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily RailRadar quota exhausted (${this.state.dailyUsed}/${this.config.dailyLimit}).`,
      };
    }

    if (this.state.monthlyUsed >= this.config.monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly RailRadar quota exhausted (${this.state.monthlyUsed}/${this.config.monthlyLimit}).`,
      };
    }

    const lastReqTs = this.recentRequests.get(trainNo);
    if (lastReqTs && now.getTime() - lastReqTs < this.config.dedupeWindowMs) {
      this.state.totalSuppressedDuplicates += 1;
      this.persist();
      return {
        allowed: false,
        reason: `Duplicate manual refresh for train ${trainNo} suppressed within ${Math.round(this.config.dedupeWindowMs / 1000)}s window.`,
      };
    }

    return { allowed: true, reason: 'Quota available' };
  }

  // Pre-call quota increment so even failed upstream attempts cannot silently burn quota untracked
  public reserveQuotaCall(trainNo: string, now = new Date()): void {
    this.rolloverPeriods(this.state, now);
    this.state.dailyUsed += 1;
    this.state.monthlyUsed += 1;
    this.state.lastExternalCallAt = now.toISOString();
    this.recentRequests.set(trainNo, now.getTime());
    this.persist();
  }

  public trigger429Cooldown(now = new Date()): string {
    const until = new Date(
      now.getTime() + this.config.cooldownMinutes429 * 60_000
    ).toISOString();
    this.state.cooldownUntil = until;
    this.persist();
    return until;
  }

  public getCachedSnapshot(
    trainNo: string,
    now = new Date()
  ): {
    snapshot: LiveTrainSnapshot | null;
    isFresh: boolean;
    withinStaleWindow: boolean;
  } {
    const clean = trainNo.trim().toUpperCase();
    const snap = this.state.snapshots[clean];
    if (!snap) {
      return { snapshot: null, isFresh: false, withinStaleWindow: false };
    }

    const referenceTs = snap.fetchedFromExternalAt ?? snap.lastUpdatedAt;
    const ageMs = Math.max(0, now.getTime() - new Date(referenceTs).getTime());
    const ageMin = Math.round(ageMs / 60_000);
    const isFresh = ageMin <= this.config.freshCacheMinutes;
    const withinStaleWindow =
      ageMs <= this.config.staleCacheDays * 24 * 60 * 60_000;

    return {
      snapshot: {
        ...snap,
        cacheAgeMinutes: ageMin,
        isStale: !isFresh,
        inWatchlist: this.state.watchlist.includes(clean),
      },
      isFresh,
      withinStaleWindow,
    };
  }

  public recordCacheHit() {
    this.state.totalCacheHits += 1;
    this.persist();
  }

  public saveSnapshot(snapshot: LiveTrainSnapshot) {
    const clean = snapshot.trainNo.trim().toUpperCase();
    const existing = this.state.snapshots[clean];
    const history = existing?.historicalObservations ?? [];
    const mergedHistory = [
      {
        observedAt: snapshot.lastUpdatedAt,
        stationCode: snapshot.lastReportedStationCode ?? snapshot.originCode,
        stationName: snapshot.lastReportedStationName ?? snapshot.originName,
        delayMin: snapshot.delayMinutes,
        source: snapshot.provenance,
        note: snapshot.sourceLabel,
      },
      ...history,
    ].slice(0, 12);

    this.state.snapshots[clean] = {
      ...snapshot,
      trainNo: clean,
      historicalObservations: mergedHistory,
    };
    this.persist();
  }

  public getWatchlistSnapshots(now = new Date()): LiveTrainSnapshot[] {
    return this.state.watchlist.map((trainNo) => {
      const cached = this.getCachedSnapshot(trainNo, now);
      if (cached.snapshot) return cached.snapshot;
      return {
        trainNo,
        trainName: `Train ${trainNo} (Watchlist Entry)`,
        originCode: 'N/A',
        originName: 'Not available',
        destinationCode: 'N/A',
        destinationName: 'Not available',
        lastReportedStationCode: null,
        lastReportedStationName: null,
        nextScheduledStationCode: null,
        nextScheduledStationName: null,
        scheduledEta: null,
        reportedEta: null,
        delayMinutes: null,
        runningStatus: 'STATUS_UNAVAILABLE',
        lastUpdatedAt: now.toISOString(),
        fetchedFromExternalAt: null,
        cacheAgeMinutes: 0,
        isStale: true,
        provenance: 'CACHED',
        sourceLabel: 'Awaiting Manual Refresh (Not Yet Cached)',
        inWatchlist: true,
        corridorTrainId: null,
        stationTimeline: [],
        historicalObservations: [],
        unavailableFieldsNote:
          'No external snapshot fetched yet. Trigger a manual refresh (quota-protected) when RailRadar API key is active.',
      };
    });
  }

  public addToWatchlist(trainNo: string, trainName?: string, now = new Date()): string[] {
    const clean = trainNo.trim().toUpperCase();
    if (!clean) return this.state.watchlist;
    if (!this.state.watchlist.includes(clean)) {
      this.state.watchlist.push(clean);
    }
    if (!this.state.snapshots[clean]) {
      this.state.snapshots[clean] = {
        trainNo: clean,
        trainName: trainName?.trim() || `Indian Railways ${clean}`,
        originCode: 'N/A',
        originName: 'Not available',
        destinationCode: 'N/A',
        destinationName: 'Not available',
        lastReportedStationCode: null,
        lastReportedStationName: null,
        nextScheduledStationCode: null,
        nextScheduledStationName: null,
        scheduledEta: null,
        reportedEta: null,
        delayMinutes: null,
        runningStatus: 'STATUS_UNAVAILABLE',
        lastUpdatedAt: now.toISOString(),
        fetchedFromExternalAt: null,
        cacheAgeMinutes: 0,
        isStale: true,
        provenance: 'CACHED',
        sourceLabel: 'Added to Watchlist — Awaiting Manual Refresh',
        inWatchlist: true,
        corridorTrainId: null,
        stationTimeline: [],
        historicalObservations: [],
        unavailableFieldsNote:
          'Running status fields are not yet populated. Use manual refresh when RailRadar API is configured.',
      };
    } else {
      this.state.snapshots[clean].inWatchlist = true;
    }
    this.persist();
    return [...this.state.watchlist];
  }

  public removeFromWatchlist(trainNo: string): string[] {
    const clean = trainNo.trim().toUpperCase();
    this.state.watchlist = this.state.watchlist.filter((t) => t !== clean);
    if (this.state.snapshots[clean]) {
      this.state.snapshots[clean].inWatchlist = false;
    }
    this.persist();
    return [...this.state.watchlist];
  }

  public getDecisions(): DecisionRecord[] {
    return [...this.state.decisions];
  }

  public recordDecision(record: DecisionRecord): DecisionRecord {
    this.state.decisions = [record, ...this.state.decisions].slice(0, 100);
    this.persist();
    return record;
  }

  public validateFleetBatch(trainNos: string[]): {
    accepted: string[];
    rejectedOverflow: string[];
  } {
    const unique = Array.from(
      new Set(trainNos.map((t) => t.trim().toUpperCase()).filter(Boolean))
    );
    return {
      accepted: unique.slice(0, this.config.maxFleetRefreshTrains),
      rejectedOverflow: unique.slice(this.config.maxFleetRefreshTrains),
    };
  }
}
