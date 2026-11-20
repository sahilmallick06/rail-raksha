import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import {
  explainPrediction,
  generateSyntheticScenariosCatalog,
  MODEL_BENCHMARK_TABLES,
  predictSyntheticRisk,
  SCENARIO_PRESETS,
} from './src/engine/kinematics.ts';
import { QuotaAndCacheStore } from './src/server/quotaStore.ts';
import type {
  DecisionRecord,
  FeatureVector10,
  LiveTrainSnapshot,
  MLModelKey,
} from './src/types/railraksha.ts';

const PORT = Number(process.env.PORT ?? 3000);
const RAILRADAR_API_KEY = (process.env.RAILRADAR_API_KEY ?? '').trim();
const RAILRADAR_API_BASE = (
  process.env.RAILRADAR_API_BASE ?? 'https://api.railradar.in/api/v1'
).replace(/\/+$/, '');
const FASTAPI_BASE_URL = (process.env.FASTAPI_BASE_URL ?? '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY ?? '').trim();

const store = new QuotaAndCacheStore({
  filePath: path.resolve(process.cwd(), 'data/railraksha-store.json'),
  config: {
    dailyLimit: Number(process.env.RAILRADAR_DAILY_LIMIT ?? 12),
    monthlyLimit: Number(process.env.RAILRADAR_MONTHLY_LIMIT ?? 240),
    maxFleetRefreshTrains: Number(
      process.env.RAILRADAR_MAX_FLEET_REFRESH ?? 3
    ),
    freshCacheMinutes: Number(process.env.RAILRADAR_FRESH_CACHE_MIN ?? 30),
    staleCacheDays: Number(process.env.RAILRADAR_STALE_CACHE_DAYS ?? 7),
  },
});

const syntheticCatalog = generateSyntheticScenariosCatalog();

// Per-client rate limit & duplicate suppression for the AI assistant
const assistantRateMap = new Map<string, number[]>();
const assistantLastPrompt = new Map<
  string,
  { hash: string; ts: number; reply: string }
>();

function parseFeatureVector(body: unknown): FeatureVector10 | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>).features ?? body;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const keys: Array<keyof FeatureVector10> = [
    'leader_speed_kmh',
    'follower_speed_kmh',
    'closing_velocity_mps',
    'net_gap_m',
    'ttc_s',
    'distance_station_throat_m',
    'weather_safety_multiplier',
    'priority',
    'block_occupancy',
    'hold_duration_s',
  ];

  const out = {} as FeatureVector10;
  for (const k of keys) {
    const val = Number(r[k]);
    if (!Number.isFinite(val)) return null;
    out[k] = val;
  }
  return out;
}

function normalizeModelKey(val: unknown): MLModelKey {
  if (val === 'catboost' || val === 'random_forest' || val === 'xgboost') {
    return val;
  }
  return 'xgboost';
}

async function fetchExternalRailRadarTrain(
  trainNo: string
): Promise<{
  ok: boolean;
  status: number;
  snapshot?: LiveTrainSnapshot;
  message: string;
}> {
  const url = `${RAILRADAR_API_BASE}/trains/${encodeURIComponent(trainNo)}/live`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-API-Key': RAILRADAR_API_KEY,
        Authorization: `Bearer ${RAILRADAR_API_KEY}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 429) {
      const until = store.trigger429Cooldown();
      return {
        ok: false,
        status: 429,
        message: `RailRadar rate limit (HTTP 429). Cooldown enabled until ${until}.`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `RailRadar upstream returned HTTP ${res.status}. Falling back to cached snapshot.`,
      };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
    const nowIso = new Date().toISOString();

    const cachedExisting = store.getCachedSnapshot(trainNo).snapshot;
    const delayRaw =
      data.delayMinutes ?? data.delay_minutes ?? data.delay ?? null;
    const delayMinutes =
      delayRaw !== null && Number.isFinite(Number(delayRaw))
        ? Number(delayRaw)
        : null;

    const lastCode =
      (data.currentStationCode as string | undefined) ??
      (data.lastReportedStationCode as string | undefined) ??
      cachedExisting?.lastReportedStationCode ??
      null;
    const lastName =
      (data.currentStationName as string | undefined) ??
      (data.lastReportedStationName as string | undefined) ??
      cachedExisting?.lastReportedStationName ??
      null;
    const nextCode =
      (data.nextStationCode as string | undefined) ??
      (data.nextScheduledStationCode as string | undefined) ??
      cachedExisting?.nextScheduledStationCode ??
      null;
    const nextName =
      (data.nextStationName as string | undefined) ??
      (data.nextScheduledStationName as string | undefined) ??
      cachedExisting?.nextScheduledStationName ??
      null;

    const snapshot: LiveTrainSnapshot = {
      trainNo,
      trainName:
        (data.trainName as string | undefined) ??
        cachedExisting?.trainName ??
        `Train ${trainNo}`,
      originCode:
        (data.sourceCode as string | undefined) ??
        cachedExisting?.originCode ??
        'N/A',
      originName:
        (data.sourceName as string | undefined) ??
        cachedExisting?.originName ??
        'Not available',
      destinationCode:
        (data.destinationCode as string | undefined) ??
        cachedExisting?.destinationCode ??
        'N/A',
      destinationName:
        (data.destinationName as string | undefined) ??
        cachedExisting?.destinationName ??
        'Not available',
      lastReportedStationCode: lastCode,
      lastReportedStationName: lastName,
      nextScheduledStationCode: nextCode,
      nextScheduledStationName: nextName,
      scheduledEta:
        (data.scheduledEta as string | undefined) ??
        cachedExisting?.scheduledEta ??
        null,
      reportedEta:
        (data.expectedEta as string | undefined) ??
        (data.reportedEta as string | undefined) ??
        cachedExisting?.reportedEta ??
        null,
      delayMinutes,
      runningStatus:
        delayMinutes === null
          ? 'STATUS_UNAVAILABLE'
          : delayMinutes >= 5
            ? 'DELAYED'
            : 'ON_TIME',
      lastUpdatedAt: nowIso,
      fetchedFromExternalAt: nowIso,
      cacheAgeMinutes: 0,
      isStale: false,
      provenance: 'THIRD_PARTY_REPORTED',
      sourceLabel: 'RailRadar External Running Status',
      inWatchlist: cachedExisting?.inWatchlist ?? true,
      corridorTrainId: cachedExisting?.corridorTrainId ?? null,
      stationTimeline: cachedExisting?.stationTimeline ?? [],
      historicalObservations: cachedExisting?.historicalObservations ?? [],
      unavailableFieldsNote:
        'RailRadar reports station-level running status only; live track-circuit coordinates, signal aspect, and meter-level headway are not provided.',
    };

    store.saveSnapshot(snapshot);
    return {
      ok: true,
      status: 200,
      snapshot,
      message: 'Live RailRadar status fetched and cached.',
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      status: 502,
      message: `RailRadar request failed (${msg}). Serving cached snapshot.`,
    };
  }
}

function buildDeterministicAssistantFallback(
  question: string,
  context: Record<string, unknown>
): string {
  const q = question.toLowerCase();
  const weather = String(context.weather ?? 'clear');
  const conflicts = Array.isArray(context.activeConflicts)
    ? (context.activeConflicts as Array<Record<string, unknown>>)
    : [];
  const top = conflicts[0];
  const quota = (context.quota as Record<string, unknown> | undefined) ?? {};

  if (q.includes('safe') || q.includes('kavach') || q.includes('sil') || q.includes('live')) {
    return [
      'RailRaksha is an academic decision-support prototype (SIH-25022, The NorthCap University) and is NOT a certified SIL-4 signalling or Kavach ATP system.',
      '• External Train Monitor fields come from cached snapshots or optional third-party RailRadar station-level running status (no track-circuit coordinates or train-to-train meter gap).',
      '• Conflict detection, headway gap, TTC, and 3D movement are computed inside the simulated 4-track NDLS trunk corridor.',
      '• ML risk scores (XGBoost / CatBoost / Random Forest) are trained on 6,480 synthetic kinematic frames and are strictly advisory.',
    ].join('\n');
  }

  if (q.includes('quota') || q.includes('railradar') || q.includes('cache')) {
    return [
      `RailRadar Quota & Cache Status (deterministic readout):`,
      `• Daily usage: ${quota.dailyUsed ?? 0}/${quota.dailyLimit ?? 12} calls · Monthly: ${quota.monthlyUsed ?? 0}/${quota.monthlyLimit ?? 240} calls.`,
      `• Fresh cache window: ${quota.freshCacheMinutes ?? 30} min · Stale reuse: ${quota.staleCacheDays ?? 7} days · Max 3 trains per manual fleet refresh.`,
      '• Automatic polling is disabled by design so quota is never burned in the background.',
    ].join('\n');
  }

  if (top) {
    return [
      `Active Simulated Conflict Summary (${String(top.id ?? 'Incident')}):`,
      `• Pair: ${String(top.followerTrainNo ?? '')} following ${String(top.leaderTrainNo ?? '')} on ${String(top.trackLabel ?? 'corridor')} (${String(top.severity ?? 'CAUTION')}).`,
      `• Kinematics [SIMULATED]: Net separation ${String(top.netGapM ?? 'N/A')} m · TTC ${String(top.ttcS ?? 'N/A')} s · Closing speed ${String(top.closingVelocityMps ?? 'N/A')} m/s · Weather: ${weather}.`,
      `• Advisory Reasoning [ML_PREDICTED_SYNTHETIC]: ${String(top.plainSummary ?? 'Inspect SHAP/LIME attribution in Conflict Centre for full feature breakdown.')}`,
      '• Recommended Controller Action: Review the Baseline vs RailRaksha AI Advisory comparison in AI Dispatch before accepting or modifying the scenario.',
    ].join('\n');
  }

  return [
    `Corridor Operational Summary (Deterministic Fallback — Weather: ${weather}):`,
    '• No DANGER or CAUTION headway conflicts are currently active in the simulated 4-track corridor.',
    '• To test conflict detection, SHAP/LIME reasoning, and baseline-vs-optimized dispatch planning, load a scenario from the Scenario Lab or start the 8-step Viva Demo Mode.',
    '• Note: All kinematic gaps and ML risk classifications are simulated/synthetic advisory outputs; human controller approval is always required.',
  ].join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Serve preserved simulator assets cleanly
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use('/simulator', express.static(path.join(publicDir, 'simulator')));

  // 1. Health endpoint
  app.get('/api/health', (_req, res) => {
    const quota = store.getQuotaStatus(Boolean(RAILRADAR_API_KEY));
    res.json({
      status: 'ok',
      service: 'RailRaksha Control Centre API',
      problemStatement: 'SIH-25022',
      academicPrototypeOnly: true,
      sil4Certified: false,
      timestamp: new Date().toISOString(),
      subsystems: {
        kinematicEngine: 'ONLINE',
        syntheticMlExplainer: 'ONLINE',
        fastApiBridge: FASTAPI_BASE_URL ? 'CONFIGURED' : 'INTEGRATED_NODE_ENGINE',
        railradarGateway: RAILRADAR_API_KEY
          ? 'KEY_CONFIGURED_QUOTA_GUARDED'
          : 'CACHED_ONLY_NO_KEY',
        geminiAssistant: GEMINI_API_KEY
          ? 'GEMINI_4_HYDROGEN_READY'
          : 'DETERMINISTIC_FALLBACK_ONLY',
      },
      quota,
    });
  });

  // 2. Models & Benchmark tables (explicitly distinguishing bundled 6,480 vs paper 3,600)
  app.get('/api/models', (_req, res) => {
    res.json({
      advisoryOnly: true,
      trainedOn: 'SYNTHETIC',
      activeRuntimeModels: ['xgboost', 'catboost', 'random_forest'],
      bundledEvaluationSummary: {
        dataset: '36 synthetic scenarios × 180 frames (0.5 s, seed 25022) = 6,480 rows',
        split: 'GroupShuffleSplit by scenario_id (21 train / 7 val / 8 test = 1,440 test rows: 1,220 CLEAR, 90 CAUTION, 130 DANGER)',
        caveat:
          'Labels are generated from deterministic headway/TTC rules, so near-100% synthetic test accuracy measures rule learnability rather than live Indian Railways safety certification.',
      },
      researchPaperSummary: {
        dataset: '6 hard-coded trains, 2-hour window at 10 Hz (N = 3,600 frames)',
        modelsEvaluated: 11,
        topModel: 'CatBoost (Macro F1 0.9640, Brier 0.0281, R² 0.9412)',
        caveat:
          'Models outside XGBoost, CatBoost, and Random Forest (e.g., LightGBM, MLP, AdaBoost, KNN) are reported as research benchmarks only.',
      },
      tables: MODEL_BENCHMARK_TABLES,
    });
  });

  // 3. ML Prediction endpoint (10-feature validation, advisory_only: true)
  app.post('/api/predict', async (req, res) => {
    const features = parseFeatureVector(req.body);
    if (!features) {
      return res.status(400).json({
        error:
          'Invalid 10-feature kinematic payload. Required numeric fields: leader_speed_kmh, follower_speed_kmh, closing_velocity_mps, net_gap_m, ttc_s, distance_station_throat_m, weather_safety_multiplier, priority, block_occupancy, hold_duration_s.',
      });
    }
    const model = normalizeModelKey((req.body as Record<string, unknown>)?.model);

    // Optional proxy to local Python FastAPI if user explicitly configured FASTAPI_BASE_URL
    if (FASTAPI_BASE_URL) {
      try {
        const upstream = await fetch(`${FASTAPI_BASE_URL}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, features }),
          signal: AbortSignal.timeout(2500),
        });
        if (upstream.ok) {
          const data = await upstream.json();
          return res.json({ ...data, servedBy: 'FASTAPI_BACKEND' });
        }
      } catch {
        // Fall through cleanly to integrated TypeScript engine
      }
    }

    const prediction = predictSyntheticRisk(features, model);
    return res.json({ ...prediction, servedBy: 'INTEGRATED_ENGINE' });
  });

  // 4. Explainability endpoint (SHAP + LIME-style weighted surrogate + deterministic physics)
  app.post('/api/explain', async (req, res) => {
    const features = parseFeatureVector(req.body);
    if (!features) {
      return res.status(400).json({
        error: 'Invalid 10-feature kinematic payload for /api/explain.',
      });
    }
    const model = normalizeModelKey((req.body as Record<string, unknown>)?.model);
    const explanation = explainPrediction(features, model);
    return res.json(explanation);
  });

  // 5. Scenarios endpoints (8 interactive controller presets + 36 synthetic dataset scenarios)
  app.get('/api/scenarios', (_req, res) => {
    res.json({
      interactivePresets: SCENARIO_PRESETS,
      syntheticDatasetScenarios: syntheticCatalog,
      provenance: 'SIMULATED',
    });
  });

  app.get('/api/scenarios/:id', (req, res) => {
    const id = req.params.id;
    const preset = SCENARIO_PRESETS.find((s) => s.id === id);
    if (preset) {
      return res.json({ type: 'INTERACTIVE_PRESET', scenario: preset });
    }
    const syn = syntheticCatalog.find((s) => s.scenarioId === id);
    if (syn) {
      return res.json({ type: 'SYNTHETIC_DATASET_SCENARIO', scenario: syn });
    }
    return res.status(404).json({ error: `Scenario ${id} not found.` });
  });

  // 6. Live / Cached Train Monitor & RailRadar Quota endpoints
  app.get('/api/live/quota', (_req, res) => {
    res.json(store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)));
  });

  app.get('/api/live/watchlist', (_req, res) => {
    res.json({
      trains: store.getWatchlistSnapshots(),
      quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
    });
  });

  app.post('/api/live/watchlist', (req, res) => {
    const trainNo = String((req.body as Record<string, unknown>)?.trainNo ?? '').trim();
    const trainName = String((req.body as Record<string, unknown>)?.trainName ?? '').trim();
    if (!/^[A-Za-z0-9-]{3,12}$/.test(trainNo)) {
      return res.status(400).json({
        error: 'Enter a valid train number (e.g., 12951, 22416, 12301).',
      });
    }
    store.addToWatchlist(trainNo, trainName || undefined);
    return res.status(201).json({
      trains: store.getWatchlistSnapshots(),
      quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
    });
  });

  app.delete('/api/live/watchlist/:trainNo', (req, res) => {
    store.removeFromWatchlist(req.params.trainNo);
    return res.json({
      trains: store.getWatchlistSnapshots(),
      quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
    });
  });

  app.get('/api/live/train/:trainNo', async (req, res) => {
    const trainNo = req.params.trainNo.trim().toUpperCase();
    const manualRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const cached = store.getCachedSnapshot(trainNo);

    // Always serve fresh cache without burning external quota
    if (cached.snapshot && (!manualRefresh || cached.isFresh)) {
      store.recordCacheHit();
      return res.json({
        snapshot: cached.snapshot,
        quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
        notice: cached.isFresh
          ? 'Served from fresh local cache (0 external quota consumed).'
          : 'Served from cached snapshot (click Manual Refresh to request external status).',
      });
    }

    if (manualRefresh) {
      const gate = store.canCallExternal(trainNo, Boolean(RAILRADAR_API_KEY));
      if (gate.allowed) {
        store.reserveQuotaCall(trainNo);
        const liveResult = await fetchExternalRailRadarTrain(trainNo);
        if (liveResult.ok && liveResult.snapshot) {
          return res.json({
            snapshot: liveResult.snapshot,
            quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
            notice: liveResult.message,
          });
        }
        if (cached.snapshot && cached.withinStaleWindow) {
          return res.json({
            snapshot: { ...cached.snapshot, isStale: true },
            quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
            notice: `${liveResult.message} Reusing cached snapshot within 7-day window.`,
          });
        }
        return res.status(liveResult.status).json({
          error: liveResult.message,
          quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
        });
      }

      // Blocked by quota, missing key, duplicate suppression, or 429 cooldown
      if (cached.snapshot && cached.withinStaleWindow) {
        store.recordCacheHit();
        return res.json({
          snapshot: cached.snapshot,
          quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
          notice: `${gate.reason} Serving cached snapshot instead.`,
        });
      }
      return res.status(429).json({
        error: gate.reason,
        quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
      });
    }

    return res.status(404).json({
      error: `Train ${trainNo} is not in local cache yet. Add it to the watchlist to inspect.`,
      quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
    });
  });

  app.post('/api/live/fleet/refresh', async (req, res) => {
    const trainNos = Array.isArray((req.body as Record<string, unknown>)?.trainNos)
      ? ((req.body as Record<string, unknown>).trainNos as string[])
      : [];

    const { accepted, rejectedOverflow } = store.validateFleetBatch(trainNos);
    const results: Array<{
      trainNo: string;
      status: 'LIVE_REFRESHED' | 'CACHE_SERVED' | 'BLOCKED';
      message: string;
    }> = [];

    for (const trainNo of accepted) {
      const cached = store.getCachedSnapshot(trainNo);
      if (cached.snapshot && cached.isFresh) {
        store.recordCacheHit();
        results.push({
          trainNo,
          status: 'CACHE_SERVED',
          message: 'Fresh cache (<30 min); skipped external call.',
        });
        continue;
      }

      const gate = store.canCallExternal(trainNo, Boolean(RAILRADAR_API_KEY));
      if (!gate.allowed) {
        results.push({
          trainNo,
          status: cached.snapshot ? 'CACHE_SERVED' : 'BLOCKED',
          message: gate.reason,
        });
        continue;
      }

      store.reserveQuotaCall(trainNo);
      const liveRes = await fetchExternalRailRadarTrain(trainNo);
      results.push({
        trainNo,
        status: liveRes.ok ? 'LIVE_REFRESHED' : 'CACHE_SERVED',
        message: liveRes.message,
      });
    }

    return res.json({
      results,
      rejectedOverflow,
      trains: store.getWatchlistSnapshots(),
      quota: store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)),
      notice:
        rejectedOverflow.length > 0
          ? `Fleet refresh capped at ${store.getQuotaStatus(Boolean(RAILRADAR_API_KEY)).maxFleetRefreshTrains} trains per manual request; skipped ${rejectedOverflow.join(', ')}.`
          : 'Manual fleet refresh completed under quota safeguards.',
    });
  });

  // 7. Controller Decision History endpoints
  app.get('/api/decisions', (_req, res) => {
    res.json({ decisions: store.getDecisions() });
  });

  app.post('/api/decisions', (req, res) => {
    const body = req.body as Partial<DecisionRecord>;
    if (!body.conflictId || !body.planId || !body.decision) {
      return res.status(400).json({
        error: 'conflictId, planId, and decision are required.',
      });
    }

    const record: DecisionRecord = {
      id: body.id ?? `DEC-${Date.now().toString(36).toUpperCase()}`,
      replayId: body.replayId ?? `RPL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      conflictId: body.conflictId,
      trainPair: body.trainPair ?? 'Corridor Pair',
      planId: body.planId,
      planVersion: body.planVersion ?? 'v2.4-advisory',
      planName: body.planName ?? 'Dispatch Plan',
      decision: body.decision,
      controllerNote: String(body.controllerNote ?? '').slice(0, 400),
      reasonCode: String(body.reasonCode ?? 'OPERATIONAL_JUDGMENT'),
      beforeMetrics: body.beforeMetrics ?? {
        minGapM: 0,
        minTtcS: 0,
        activeConflicts: 0,
        totalDelayMin: 0,
      },
      afterMetrics: body.afterMetrics ?? {
        minGapM: 0,
        minTtcS: 0,
        activeConflicts: 0,
        totalDelayMin: 0,
      },
      provenance: 'CONTROLLER_DECISION',
    };

    const saved = store.recordDecision(record);
    return res.status(201).json({ decision: saved, decisions: store.getDecisions() });
  });

  // 8. RailRaksha Intelligence Assistant (server-side Gemini with deterministic fallback)
  app.post('/api/assistant', async (req, res) => {
    const clientIp = req.ip || 'local';
    const now = Date.now();
    const prompt = String((req.body as Record<string, unknown>)?.prompt ?? '').trim();
    const context =
      ((req.body as Record<string, unknown>)?.context as
        | Record<string, unknown>
        | undefined) ?? {};

    if (!prompt || prompt.length > 900) {
      return res.status(400).json({
        error: 'Provide a concise operational question (1–900 characters).',
      });
    }

    // Duplicate suppression within 8 seconds
    const promptHash = `${prompt.toLowerCase()}::${String(context.activeView ?? '')}`;
    const last = assistantLastPrompt.get(clientIp);
    if (last && last.hash === promptHash && now - last.ts < 8000) {
      return res.json({
        reply: last.reply,
        provider: 'DEDUPED_CACHE',
        fallbackUsed: false,
        provenance: 'DERIVED_ESTIMATE',
      });
    }

    // Rate limit: 12 requests per minute per IP
    const timestamps = (assistantRateMap.get(clientIp) ?? []).filter(
      (t) => now - t < 60_000
    );
    if (timestamps.length >= 12) {
      return res.status(429).json({
        error:
          'Assistant rate limit reached (12 questions/min). Wait a moment before asking again.',
      });
    }
    timestamps.push(now);
    assistantRateMap.set(clientIp, timestamps);

    const fallbackReply = buildDeterministicAssistantFallback(prompt, context);

    if (!GEMINI_API_KEY) {
      assistantLastPrompt.set(clientIp, {
        hash: promptHash,
        ts: now,
        reply: fallbackReply,
      });
      return res.json({
        reply: fallbackReply,
        provider: 'DETERMINISTIC_OPERATIONAL_EXPLAINER',
        fallbackUsed: true,
        provenance: 'DERIVED_ESTIMATE',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const systemInstruction = [
        'You are the RailRaksha Intelligence Assistant inside an academic railway traffic control decision-support prototype (SIH-25022, The NorthCap University).',
        'STRICT RULES:',
        '1. Ground every answer ONLY in the structured JSON operational context provided.',
        '2. Never invent live train coordinates, signal aspects, or external API results that are absent.',
        '3. Always distinguish between THIRD_PARTY_REPORTED/CACHED station status, SIMULATED corridor kinematics, ML_PREDICTED_SYNTHETIC risk scores, and CONTROLLER_DECISION records.',
        '4. Never claim SIL-4 certification, Kavach ATP authority, or ability to execute live railway dispatch commands.',
        '5. Be concise, operational, and structured in plain language suitable for railway controllers and faculty evaluators (under 180 words).',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `OPERATIONAL_CONTEXT_JSON:\n${JSON.stringify(context).slice(0, 6000)}\n\nCONTROLLER_QUESTION:\n${prompt}`,
        config: {
          systemInstruction,
          temperature: 0.25,
          maxOutputTokens: 320,
        },
      });

      const text = response.text?.trim() || fallbackReply;
      assistantLastPrompt.set(clientIp, {
        hash: promptHash,
        ts: now,
        reply: text,
      });

      return res.json({
        reply: text,
        provider: 'GEMINI_4_HYDROGEN',
        fallbackUsed: false,
        provenance: 'DERIVED_ESTIMATE',
      });
    } catch {
      assistantLastPrompt.set(clientIp, {
        hash: promptHash,
        ts: now,
        reply: fallbackReply,
      });
      return res.json({
        reply: fallbackReply,
        provider: 'DETERMINISTIC_FALLBACK_ON_API_ERROR',
        fallbackUsed: true,
        provenance: 'DERIVED_ESTIMATE',
      });
    }
  });

  // Frontend mounting: Vite middleware in dev, static dist in prod
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/simulator/')) {
        return next();
      }
      return res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[RailRaksha] Full-stack Control Centre running on http://localhost:${PORT}`
    );
  });
}

startServer();
