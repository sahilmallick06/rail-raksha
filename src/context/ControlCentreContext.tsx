import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  applyScenarioPreset,
  buildConflictsFromCorridor,
  buildOptimizationPlans,
  createInitialCorridorTrains,
  explainPrediction,
  SCENARIO_PRESETS,
  stepCorridorSimulation,
} from '../engine/kinematics.ts';
import type {
  AssistantMessage,
  ConflictIncident,
  CorridorTrain,
  DecisionRecord,
  DispatchPlan,
  ExplainabilityResponse,
  LiveTrainSnapshot,
  MLModelKey,
  PrimaryView,
  QuotaStatus,
  ScenarioPreset,
  SecondaryToolTab,
  WeatherMode,
} from '../types/railraksha.ts';

export interface DemoStepConfig {
  step: number;
  title: string;
  talkingPoint: string;
  targetView: PrimaryView;
  actionLabel: string;
}

export const DEMO_STEPS: DemoStepConfig[] = [
  {
    step: 1,
    title: 'Control Centre Overview & Provenance',
    talkingPoint:
      'Review the 4-track simulated corridor, 4 KPI metrics with explicit provenance tags, and zero-quota startup state.',
    targetView: 'overview',
    actionLabel: 'Next: Inspect Cached 22416',
  },
  {
    step: 2,
    title: 'External Running Status (22416 — Cached)',
    talkingPoint:
      'Inspect Train 22416 (Varanasi Vande Bharat) from local cache with 0 RailRadar quota burned. Missing track-circuit coordinates are transparently marked Not available.',
    targetView: 'monitor',
    actionLabel: 'Next: Inject Headway Conflict',
  },
  {
    step: 3,
    title: 'Load Headway Conflict Scenario',
    talkingPoint:
      'Inject a reproducible DANGER conflict: 22416 closing on 20818 at 124 vs 62 km/h with 36 m net separation on Line 0.',
    targetView: 'conflicts',
    actionLabel: 'Next: Explain Physics & TTC',
  },
  {
    step: 4,
    title: 'Explain Gap, Closing Speed & Braking-Aware TTC',
    talkingPoint:
      'Examine deterministic thresholds (gap <= 40 m, TTC <= 3.0 s × α_throat × β_weather) and the no-AI counterfactual collision envelope.',
    targetView: 'conflicts',
    actionLabel: 'Next: Inspect SHAP & LIME XAI',
  },
  {
    step: 5,
    title: 'Explainable AI — SHAP & LIME Attribution',
    talkingPoint:
      'Inspect plain-language top-3 risk factors alongside SHAP & LIME-style attributions from synthetic-trained GBDT classifiers (advisory only).',
    targetView: 'conflicts',
    actionLabel: 'Next: Compare Dispatch Plans',
  },
  {
    step: 6,
    title: 'Compare Baseline vs AI Advisory & Decide',
    talkingPoint:
      'Compare calculated delay, waiting time, separation, and tradeoffs across Baseline, RailRaksha Advisory, and Safety-First Hold before human approval.',
    targetView: 'dispatch',
    actionLabel: 'Next: Open 3D Digital Twin',
  },
  {
    step: 7,
    title: 'Sync & Replay in 3D Digital Twin',
    talkingPoint:
      'View the preserved Babylon.js 3D corridor synced over BroadcastChannel (railraksha-live-v3) while keeping the Control Centre independent.',
    targetView: 'twin',
    actionLabel: 'Next: Review Audit & Impact',
  },
  {
    step: 8,
    title: 'Impact Summary & Controller Audit Trail',
    talkingPoint:
      'Inspect recorded Human-in-the-Loop decisions with before/after metrics, replay ID, controller notes, and scientific boundaries.',
    targetView: 'overview',
    actionLabel: 'Finish Viva Demo',
  },
];

interface ControlCentreValue {
  // Navigation & shell UI
  showIntro: boolean;
  enterControlCentre: () => void;
  replayIntro: () => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  activeView: PrimaryView;
  setActiveView: (v: PrimaryView) => void;
  secondaryToolsOpen: boolean;
  secondaryToolsTab: SecondaryToolTab;
  openSecondaryTools: (tab?: SecondaryToolTab) => void;
  closeSecondaryTools: () => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;

  // Simulated corridor state
  trains: CorridorTrain[];
  weather: WeatherMode;
  setWeather: (w: WeatherMode) => void;
  simRunning: boolean;
  setSimRunning: (v: boolean) => void;
  aiAdvisoryAutoPace: boolean;
  setAiAdvisoryAutoPace: (v: boolean) => void;
  selectedCorridorTrainId: string;
  setSelectedCorridorTrainId: (id: string) => void;
  activeScenarioName: string;
  loadScenarioPreset: (preset: ScenarioPreset) => void;
  injectQuickConflict: () => void;
  resetCorridor: () => void;
  lastSimTickAt: string;

  // Conflicts & XAI
  conflicts: ConflictIncident[];
  selectedConflictId: string | null;
  setSelectedConflictId: (id: string | null) => void;
  selectedConflict: ConflictIncident | null;
  activeModel: MLModelKey;
  setActiveModel: (m: MLModelKey) => void;
  activeExplanation: ExplainabilityResponse | null;
  xaiViewTab: 'plain' | 'shap' | 'lime';
  setXaiViewTab: (t: 'plain' | 'shap' | 'lime') => void;

  // Dispatch plans & HITL decisions
  dispatchPlans: DispatchPlan[];
  decisions: DecisionRecord[];
  submitControllerDecision: (payload: {
    plan: DispatchPlan;
    decision: DecisionRecord['decision'];
    controllerNote: string;
    reasonCode: string;
    customTargetSpeedKmh?: number;
  }) => Promise<DecisionRecord | null>;

  // Live / Cached Train Monitor & RailRadar quota
  watchlistTrains: LiveTrainSnapshot[];
  selectedMonitorTrainNo: string | null;
  setSelectedMonitorTrainNo: (trainNo: string | null) => void;
  quota: QuotaStatus | null;
  monitorNotice: string | null;
  refreshingTrainNo: string | null;
  refreshingFleet: boolean;
  addWatchlistTrain: (trainNo: string, trainName?: string) => Promise<string | null>;
  removeWatchlistTrain: (trainNo: string) => Promise<void>;
  refreshSingleTrain: (trainNo: string) => Promise<void>;
  refreshSelectedFleet: (trainNos: string[]) => Promise<void>;

  // Digital Twin BroadcastChannel bridge
  twinConnected: boolean;
  lastTwinSyncAt: string | null;
  sendTwinCommand: (msg: Record<string, unknown>) => void;
  twinIframeRef: React.RefObject<HTMLIFrameElement | null>;

  // Assistant
  assistantMessages: AssistantMessage[];
  assistantLoading: boolean;
  sendAssistantPrompt: (prompt: string) => Promise<void>;

  // System health & model benchmarks
  healthData: Record<string, unknown> | null;
  modelsData: Record<string, unknown> | null;

  // Viva Presentation Demo Mode
  demoStep: number | null;
  startDemoMode: () => void;
  nextDemoStep: () => void;
  resetDemoMode: () => void;
  exitDemoMode: () => void;
}

const ControlCentreContext = createContext<ControlCentreValue | null>(null);

export const ControlCentreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [showIntro, setShowIntro] = useState<boolean>(() => !autostart);
  const [reducedMotion, setReducedMotion] = useState<boolean>(prefersReduced);
  const [activeView, setActiveView] = useState<PrimaryView>('overview');
  const [secondaryToolsOpen, setSecondaryToolsOpen] = useState(false);
  const [secondaryToolsTab, setSecondaryToolsTab] =
    useState<SecondaryToolTab>('timetable');
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Corridor simulation (runs independently of Babylon.js iframe)
  const [trains, setTrains] = useState<CorridorTrain[]>(() =>
    createInitialCorridorTrains()
  );
  const [weather, setWeatherState] = useState<WeatherMode>('clear');
  const [simRunning, setSimRunning] = useState<boolean>(true);
  const [aiAdvisoryAutoPace, setAiAdvisoryAutoPace] = useState<boolean>(false);
  const [selectedCorridorTrainId, setSelectedCorridorTrainId] =
    useState<string>('T02');
  const [activeScenarioName, setActiveScenarioName] = useState<string>(
    'Nominal 4-Track Corridor (Seeded)'
  );
  const [lastSimTickAt, setLastSimTickAt] = useState<string>(() =>
    new Date().toISOString()
  );
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<string, ConflictIncident['reviewStatus']>
  >({});

  // Conflicts & Explainability
  const [activeModel, setActiveModel] = useState<MLModelKey>('xgboost');
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    null
  );
  const [xaiViewTab, setXaiViewTab] = useState<'plain' | 'shap' | 'lime'>(
    'plain'
  );
  const [serverExplanation, setServerExplanation] =
    useState<ExplainabilityResponse | null>(null);

  // Watchlist, Quota, Decisions, Health, Models
  const [watchlistTrains, setWatchlistTrains] = useState<LiveTrainSnapshot[]>(
    []
  );
  const [selectedMonitorTrainNo, setSelectedMonitorTrainNo] = useState<
    string | null
  >(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [monitorNotice, setMonitorNotice] = useState<string | null>(null);
  const [refreshingTrainNo, setRefreshingTrainNo] = useState<string | null>(
    null
  );
  const [refreshingFleet, setRefreshingFleet] = useState(false);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(
    null
  );
  const [modelsData, setModelsData] = useState<Record<string, unknown> | null>(
    null
  );

  // Digital Twin BroadcastChannel
  const [twinConnected, setTwinConnected] = useState(false);
  const [lastTwinSyncAt, setLastTwinSyncAt] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const twinIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Assistant
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'RailRaksha Intelligence Assistant ready. Ask about active simulated conflicts, SHAP/LIME risk factors, dispatch tradeoffs, RailRadar quota limits, or academic prototype boundaries.',
      timestamp: new Date().toISOString(),
      provider: 'SYSTEM_INTRO',
      provenance: 'DERIVED_ESTIMATE',
    },
  ]);
  const [assistantLoading, setAssistantLoading] = useState(false);

  // Demo mode
  const [demoStep, setDemoStep] = useState<number | null>(null);

  // Compute conflicts & dispatch plans cleanly from current corridor state
  const conflicts = useMemo(
    () => buildConflictsFromCorridor(trains, weather, activeModel, reviewStatuses),
    [trains, weather, activeModel, reviewStatuses]
  );

  const selectedConflict = useMemo(() => {
    if (conflicts.length === 0) return null;
    if (selectedConflictId) {
      const found = conflicts.find((c) => c.id === selectedConflictId);
      if (found) return found;
    }
    return conflicts[0];
  }, [conflicts, selectedConflictId]);

  // Synchronous local explanation (zero flicker) enriched with server /api/explain
  const localExplanation = useMemo(() => {
    if (!selectedConflict) return null;
    return explainPrediction(selectedConflict.features, activeModel);
  }, [selectedConflict, activeModel]);

  useEffect(() => {
    if (!selectedConflict) {
      setServerExplanation(null);
      return;
    }
    let cancelled = false;
    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        features: selectedConflict.features,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setServerExplanation(data as ExplainabilityResponse);
        }
      })
      .catch(() => {
        // Local explanation already displayed
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedConflict?.id,
    selectedConflict?.netGapM,
    selectedConflict?.ttcS,
    activeModel,
  ]);

  const activeExplanation = serverExplanation ?? localExplanation;

  const dispatchPlans = useMemo(
    () => buildOptimizationPlans(trains, selectedConflict, weather),
    [trains, selectedConflict, weather]
  );

  // Initial server data hydration (0 external API calls — cached snapshots only)
  useEffect(() => {
    Promise.all([
      fetch('/api/live/watchlist').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/decisions').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/health').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/models').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([wl, dec, health, models]) => {
        if (wl) {
          setWatchlistTrains(wl.trains ?? []);
          setQuota(wl.quota ?? null);
        }
        if (dec?.decisions) setDecisions(dec.decisions);
        if (health) setHealthData(health);
        if (models) setModelsData(models);
      })
      .catch(() => {
        // Resilient offline start
      });
  }, []);

  // BroadcastChannel bridge to Babylon.js Digital Twin
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('railraksha-live-v3');
    channelRef.current = ch;
    ch.onmessage = (ev) => {
      const data = ev.data as Record<string, unknown> | null;
      if (data && data.source === 'BABYLON_DIGITAL_TWIN_V2') {
        setTwinConnected(true);
        setLastTwinSyncAt(new Date().toISOString());
      }
    };
    ch.postMessage({ type: 'REQUEST_SNAPSHOT' });
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  const sendTwinCommand = useCallback((msg: Record<string, unknown>) => {
    channelRef.current?.postMessage(msg);
    try {
      twinIframeRef.current?.contentWindow?.postMessage(msg, '*');
    } catch {
      // Iframe not mounted yet
    }
  }, []);

  // Independent corridor simulation ticker (paused when user pauses or during intro)
  useEffect(() => {
    if (!simRunning || showIntro) return;
    const timer = window.setInterval(() => {
      setTrains((prev) =>
        stepCorridorSimulation(prev, weather, 1.0, aiAdvisoryAutoPace)
      );
      setLastSimTickAt(new Date().toISOString());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [simRunning, showIntro, weather, aiAdvisoryAutoPace]);

  const setWeather = useCallback(
    (w: WeatherMode) => {
      setWeatherState(w);
      setTrains((prev) => stepCorridorSimulation(prev, w, 0, aiAdvisoryAutoPace));
      sendTwinCommand({ type: 'SET_WEATHER', weather: w });
    },
    [aiAdvisoryAutoPace, sendTwinCommand]
  );

  const loadScenarioPreset = useCallback(
    (preset: ScenarioPreset) => {
      setTrains((prev) => {
        const applied = applyScenarioPreset(prev, preset);
        setWeatherState(applied.weather);
        return applied.trains;
      });
      setActiveScenarioName(preset.name);
      setSelectedCorridorTrainId(preset.targetTrainId);
      setLastSimTickAt(new Date().toISOString());
      sendTwinCommand({ type: 'SET_SCENARIO', preset });
    },
    [sendTwinCommand]
  );

  const injectQuickConflict = useCallback(() => {
    loadScenarioPreset(SCENARIO_PRESETS[0]);
    sendTwinCommand({ type: 'INJECT_CONFLICT' });
  }, [loadScenarioPreset, sendTwinCommand]);

  const resetCorridor = useCallback(() => {
    setTrains(createInitialCorridorTrains());
    setWeatherState('clear');
    setActiveScenarioName('Nominal 4-Track Corridor (Reset)');
    setReviewStatuses({});
    setSelectedConflictId(null);
    sendTwinCommand({ type: 'REMOVE_CONFLICT' });
  }, [sendTwinCommand]);

  const submitControllerDecision = useCallback(
    async (payload: {
      plan: DispatchPlan;
      decision: DecisionRecord['decision'];
      controllerNote: string;
      reasonCode: string;
      customTargetSpeedKmh?: number;
    }): Promise<DecisionRecord | null> => {
      const beforeMetrics = {
        minGapM: Math.round(
          selectedConflict?.netGapM ?? Math.min(...trains.map((t) => t.netGapM))
        ),
        minTtcS: Number(
          (
            selectedConflict?.ttcS ?? Math.min(...trains.map((t) => t.ttcS))
          ).toFixed(1)
        ),
        activeConflicts: conflicts.filter((c) => c.severity !== 'CLEAR').length,
        totalDelayMin: trains.reduce((acc, t) => acc + t.delayMin, 0),
      };

      const afterMetrics =
        payload.decision === 'REJECTED_PROPOSAL'
          ? beforeMetrics
          : {
              minGapM: payload.plan.metrics.projectedMinGapM,
              minTtcS: payload.plan.metrics.projectedMinTtcS,
              activeConflicts: payload.plan.metrics.projectedConflictsRemaining,
              totalDelayMin: payload.plan.metrics.predictedTotalDelayMin,
            };

      // Apply to simulated corridor immediately when accepted or modified
      if (payload.decision !== 'REJECTED_PROPOSAL') {
        const actionsToApply = payload.plan.actions.map((a) => ({
          ...a,
          targetSpeedKmh:
            payload.decision === 'MODIFIED_SCENARIO' &&
            typeof payload.customTargetSpeedKmh === 'number' &&
            a.trainId === selectedConflict?.followerId
              ? payload.customTargetSpeedKmh
              : a.targetSpeedKmh,
        }));

        setTrains((prev) => {
          const updated = prev.map((t) => {
            const act = actionsToApply.find((a) => a.trainId === t.id);
            if (!act) return t;
            const nextSpeed =
              typeof act.targetSpeedKmh === 'number'
                ? act.targetSpeedKmh
                : t.speedKmh;
            const gapReliefM =
              act.actionType === 'HOLD'
                ? 110
                : act.actionType === 'SPEED_REGULATE'
                  ? 75
                  : 0;
            return {
              ...t,
              speedKmh: nextSpeed,
              targetSpeedKmh: nextSpeed,
              positionM: Math.max(240, t.positionM - gapReliefM),
              holdDurationS: act.holdSeconds ?? 0,
              delayMin: t.delayMin + Math.max(0, act.estimatedDelayDeltaMin),
            };
          });
          return stepCorridorSimulation(updated, weather, 0, true);
        });

        sendTwinCommand({ type: 'APPLY_PLAN', actions: actionsToApply });
      }

      if (selectedConflict) {
        setReviewStatuses((prev) => ({
          ...prev,
          [selectedConflict.id]:
            payload.decision === 'REJECTED_PROPOSAL' ? 'REJECTED' : 'ACCEPTED',
        }));
      }

      const body = {
        conflictId: payload.plan.conflictId,
        trainPair: selectedConflict
          ? `${selectedConflict.followerTrainNo} -> ${selectedConflict.leaderTrainNo}`
          : 'Corridor Nominal',
        planId: payload.plan.id,
        planVersion: payload.plan.version,
        planName: payload.plan.name,
        decision: payload.decision,
        controllerNote: payload.controllerNote,
        reasonCode: payload.reasonCode,
        beforeMetrics,
        afterMetrics,
      };

      try {
        const res = await fetch('/api/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          setDecisions(data.decisions ?? []);
          return data.decision as DecisionRecord;
        }
      } catch {
        // Optimistic local fallback if server temporarily unreachable
      }

      const localRec: DecisionRecord = {
        id: `DEC-${Date.now().toString(36).toUpperCase()}`,
        replayId: `RPL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        ...body,
        provenance: 'CONTROLLER_DECISION',
      };
      setDecisions((prev) => [localRec, ...prev]);
      return localRec;
    },
    [conflicts, selectedConflict, sendTwinCommand, trains, weather]
  );

  // Watchlist & RailRadar manual refresh handlers
  const addWatchlistTrain = useCallback(
    async (trainNo: string, trainName?: string): Promise<string | null> => {
      try {
        const res = await fetch('/api/live/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trainNo, trainName }),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? 'Unable to add train.';
        setWatchlistTrains(data.trains ?? []);
        setQuota(data.quota ?? null);
        setMonitorNotice(`Added train ${trainNo.toUpperCase()} to watchlist (0 API quota used).`);
        return null;
      } catch {
        return 'Network error while updating watchlist.';
      }
    },
    []
  );

  const removeWatchlistTrain = useCallback(async (trainNo: string) => {
    try {
      const res = await fetch(
        `/api/live/watchlist/${encodeURIComponent(trainNo)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const data = await res.json();
        setWatchlistTrains(data.trains ?? []);
        setQuota(data.quota ?? null);
        setSelectedMonitorTrainNo((cur) => (cur === trainNo ? null : cur));
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const refreshSingleTrain = useCallback(async (trainNo: string) => {
    setRefreshingTrainNo(trainNo);
    try {
      const res = await fetch(
        `/api/live/train/${encodeURIComponent(trainNo)}?refresh=1`
      );
      const data = await res.json();
      if (data.quota) setQuota(data.quota);
      if (data.snapshot) {
        setWatchlistTrains((prev) =>
          prev.map((t) => (t.trainNo === trainNo ? data.snapshot : t))
        );
      }
      setMonitorNotice(
        data.notice ?? data.error ?? `Refresh check finished for ${trainNo}.`
      );
    } catch {
      setMonitorNotice(`Unable to reach RailRadar gateway for ${trainNo}.`);
    } finally {
      setRefreshingTrainNo(null);
    }
  }, []);

  const refreshSelectedFleet = useCallback(async (trainNos: string[]) => {
    setRefreshingFleet(true);
    try {
      const res = await fetch('/api/live/fleet/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainNos }),
      });
      const data = await res.json();
      if (data.trains) setWatchlistTrains(data.trains);
      if (data.quota) setQuota(data.quota);
      setMonitorNotice(data.notice ?? 'Manual fleet refresh finished.');
    } catch {
      setMonitorNotice('Unable to reach RailRadar fleet refresh endpoint.');
    } finally {
      setRefreshingFleet(false);
    }
  }, []);

  // Assistant query
  const sendAssistantPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || assistantLoading) return;
      const userMsg: AssistantMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setAssistantMessages((prev) => [...prev, userMsg]);
      setAssistantLoading(true);

      const context = {
        activeView,
        weather,
        activeScenarioName,
        simRunning,
        monitoredCorridorTrains: trains.length,
        activeConflicts: conflicts.slice(0, 3).map((c) => ({
          id: c.id,
          followerTrainNo: c.followerTrainNo,
          leaderTrainNo: c.leaderTrainNo,
          trackLabel: c.trackLabel,
          severity: c.severity,
          netGapM: c.netGapM,
          ttcS: c.ttcS,
          closingVelocityMps: c.closingVelocityMps,
          plainSummary: c.plainSummary,
        })),
        recentDecisionsCount: decisions.length,
        quota,
      };

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, context }),
        });
        const data = await res.json();
        setAssistantMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content:
              data.reply ??
              data.error ??
              'Assistant could not generate a response right now.',
            timestamp: new Date().toISOString(),
            provider: data.provider,
            provenance: data.provenance ?? 'DERIVED_ESTIMATE',
            fallbackUsed: data.fallbackUsed,
          },
        ]);
      } catch {
        setAssistantMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content:
              'Backend assistant endpoint unreachable. All core corridor kinematics, SHAP/LIME reasoning, and optimization plans remain fully operational.',
            timestamp: new Date().toISOString(),
            provider: 'OFFLINE_FALLBACK',
            fallbackUsed: true,
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [
      activeScenarioName,
      activeView,
      assistantLoading,
      conflicts,
      decisions.length,
      quota,
      simRunning,
      trains.length,
      weather,
    ]
  );

  // 8-Step Viva Presentation Demo Mode
  const applyDemoStepEffects = useCallback(
    (step: number) => {
      setShowIntro(false);
      setSecondaryToolsOpen(false);
      setSelectedMonitorTrainNo(null);

      if (step === 1) {
        setActiveView('overview');
        resetCorridor();
      } else if (step === 2) {
        setActiveView('monitor');
        setSelectedMonitorTrainNo('22416');
      } else if (step === 3) {
        loadScenarioPreset(SCENARIO_PRESETS[0]);
        setSimRunning(false); // Freeze conflict cleanly for faculty inspection
        setActiveView('conflicts');
        setXaiViewTab('plain');
      } else if (step === 4) {
        setActiveView('conflicts');
        setXaiViewTab('plain');
      } else if (step === 5) {
        setActiveView('conflicts');
        setXaiViewTab('shap');
      } else if (step === 6) {
        setActiveView('dispatch');
      } else if (step === 7) {
        setActiveView('twin');
        setSimRunning(true);
      } else if (step === 8) {
        setActiveView('overview');
        setSecondaryToolsTab('history');
        setSecondaryToolsOpen(true);
      }
    },
    [loadScenarioPreset, resetCorridor]
  );

  const startDemoMode = useCallback(() => {
    setDemoStep(1);
    applyDemoStepEffects(1);
  }, [applyDemoStepEffects]);

  const nextDemoStep = useCallback(() => {
    setDemoStep((cur) => {
      if (cur === null) return 1;
      if (cur >= 8) {
        setSecondaryToolsOpen(false);
        return null;
      }
      const next = cur + 1;
      applyDemoStepEffects(next);
      return next;
    });
  }, [applyDemoStepEffects]);

  const resetDemoMode = useCallback(() => {
    setDemoStep(1);
    applyDemoStepEffects(1);
  }, [applyDemoStepEffects]);

  const exitDemoMode = useCallback(() => {
    setDemoStep(null);
    setSecondaryToolsOpen(false);
    setSimRunning(true);
  }, []);

  const enterControlCentre = useCallback(() => {
    setShowIntro(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const replayIntro = useCallback(() => {
    setSecondaryToolsOpen(false);
    setShowIntro(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const openSecondaryTools = useCallback((tab?: SecondaryToolTab) => {
    if (tab) setSecondaryToolsTab(tab);
    setSecondaryToolsOpen(true);
  }, []);

  const closeSecondaryTools = useCallback(() => {
    setSecondaryToolsOpen(false);
  }, []);

  const value: ControlCentreValue = {
    showIntro,
    enterControlCentre,
    replayIntro,
    reducedMotion,
    setReducedMotion,
    activeView,
    setActiveView,
    secondaryToolsOpen,
    secondaryToolsTab,
    openSecondaryTools,
    closeSecondaryTools,
    assistantOpen,
    setAssistantOpen,
    trains,
    weather,
    setWeather,
    simRunning,
    setSimRunning,
    aiAdvisoryAutoPace,
    setAiAdvisoryAutoPace,
    selectedCorridorTrainId,
    setSelectedCorridorTrainId,
    activeScenarioName,
    loadScenarioPreset,
    injectQuickConflict,
    resetCorridor,
    lastSimTickAt,
    conflicts,
    selectedConflictId,
    setSelectedConflictId,
    selectedConflict,
    activeModel,
    setActiveModel,
    activeExplanation,
    xaiViewTab,
    setXaiViewTab,
    dispatchPlans,
    decisions,
    submitControllerDecision,
    watchlistTrains,
    selectedMonitorTrainNo,
    setSelectedMonitorTrainNo,
    quota,
    monitorNotice,
    refreshingTrainNo,
    refreshingFleet,
    addWatchlistTrain,
    removeWatchlistTrain,
    refreshSingleTrain,
    refreshSelectedFleet,
    twinConnected,
    lastTwinSyncAt,
    sendTwinCommand,
    twinIframeRef,
    assistantMessages,
    assistantLoading,
    sendAssistantPrompt,
    healthData,
    modelsData,
    demoStep,
    startDemoMode,
    nextDemoStep,
    resetDemoMode,
    exitDemoMode,
  };

  return (
    <ControlCentreContext.Provider value={value}>
      {children}
    </ControlCentreContext.Provider>
  );
};

export function useControlCentre(): ControlCentreValue {
  const ctx = useContext(ControlCentreContext);
  if (!ctx) {
    throw new Error(
      'useControlCentre must be used within ControlCentreProvider'
    );
  }
  return ctx;
}
