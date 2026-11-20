import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  CloudRain,
  GitBranch,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import {
  CORRIDOR_CONFIG,
  CORRIDOR_STATIONS,
  WEATHER_PROFILES,
} from '../engine/kinematics.ts';
import type { WeatherMode } from '../types/railraksha.ts';

function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export const OverviewView: React.FC = () => {
  const {
    trains,
    weather,
    setWeather,
    simRunning,
    setSimRunning,
    selectedCorridorTrainId,
    setSelectedCorridorTrainId,
    activeScenarioName,
    injectQuickConflict,
    resetCorridor,
    lastSimTickAt,
    conflicts,
    watchlistTrains,
    decisions,
    quota,
    setActiveView,
    setSelectedConflictId,
    openSecondaryTools,
    twinConnected,
  } = useControlCentre();

  const activeConflicts = conflicts.filter((c) => c.severity !== 'CLEAR');
  const pendingDecisions = activeConflicts.filter(
    (c) => c.reviewStatus === 'PENDING' || c.reviewStatus === 'UNDER_REVIEW'
  ).length;
  const delayedExternalCount = watchlistTrains.filter(
    (t) => t.delayMinutes !== null && t.delayMinutes >= 5
  ).length;
  const topConflict = activeConflicts[0] ?? null;
  const selectedTrain =
    trains.find((t) => t.id === selectedCorridorTrainId) ?? trains[1];

  const sourceMode = quota?.railradarKeyConfigured
    ? 'Cached + Manual RailRadar + Simulated Corridor'
    : 'Cached External Snapshots + Simulated Corridor';

  return (
    <div className="space-y-6">
      {/* Compact Operational Header Bar */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#1C2C47] pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="font-mono text-xs text-sky-400">
            OPERATIONS OVERVIEW · {CORRIDOR_CONFIG.corridorName}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
            Section Traffic & Headway Command
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-slate-400">
            <span>Mode: {sourceMode}</span>
            <span className="text-slate-600">·</span>
            <span>Scenario: {activeScenarioName}</span>
            <span className="text-slate-600">·</span>
            <span className="tabular-nums">
              Last Tick: {formatTimeShort(lastSimTickAt)}
            </span>
            <span className="text-slate-600">·</span>
            <span className={twinConnected ? 'text-emerald-400' : 'text-slate-400'}>
              Digital Twin: {twinConnected ? 'Synced' : 'Standby (Independent)'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
          <button
            type="button"
            onClick={() => setSimRunning(!simRunning)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-[#1C2C47] bg-[#0C1424] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-500/60"
          >
            {simRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                Pause Sim
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                Resume Sim
              </>
            )}
          </button>

          <button
            type="button"
            onClick={injectQuickConflict}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Inject Headway Conflict
          </button>

          <button
            type="button"
            onClick={resetCorridor}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-[#1C2C47] bg-[#0C1424] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </section>

      {/* Strictly 4 Core KPI Cards — each with explicit provenance & freshness */}
      <section
        aria-label="Key Operational Metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span>MONITORED TRAINS</span>
            <span className="text-sky-400">SIMULATED + CACHED</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-white">
              {trains.length}
            </span>
            <span className="font-mono text-xs text-slate-400">
              corridor · {watchlistTrains.length} watchlist
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-slate-500">
            Updated {formatTimeShort(lastSimTickAt)} · 4 tracks · 30 blocks
          </div>
        </div>

        <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span>TRAINS REPORTING DELAYS</span>
            <span className="text-amber-400">CACHED / EXTERNAL</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-amber-300">
              {delayedExternalCount}
            </span>
            <span className="font-mono text-xs text-slate-400">
              of {watchlistTrains.length} (&gt;= 5 min)
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-slate-500">
            RailRadar quota: {quota?.dailyUsed ?? 0}/{quota?.dailyLimit ?? 12} daily used
          </div>
        </div>

        <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span>ACTIVE SIMULATED CONFLICTS</span>
            <span
              className={
                activeConflicts.length > 0 ? 'text-red-400' : 'text-emerald-400'
              }
            >
              SIMULATED
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-3xl font-bold tabular-nums ${
                activeConflicts.length > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {activeConflicts.length}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {activeConflicts.filter((c) => c.severity === 'DANGER').length} DANGER ·{' '}
              {activeConflicts.filter((c) => c.severity === 'CAUTION').length} CAUTION
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-slate-500">
            Weather factor: {WEATHER_PROFILES[weather].betaMultiplier.toFixed(2)}× ({WEATHER_PROFILES[weather].label})
          </div>
        </div>

        <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span>PENDING DECISIONS</span>
            <span className="text-sky-400">CONTROLLER_DECISION</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-white">
              {pendingDecisions}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {decisions.length} logged total
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-slate-500">
            Human-in-the-loop required before plan execution
          </div>
        </div>
      </section>

      {/* Priority Alert Panel */}
      <section className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
        {topConflict ? (
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 font-mono text-xs">
                <ShieldAlert
                  className={`h-4 w-4 ${
                    topConflict.severity === 'DANGER'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                />
                <span
                  className={`font-semibold ${
                    topConflict.severity === 'DANGER'
                      ? 'text-red-400'
                      : 'text-amber-300'
                  }`}
                >
                  PRIORITY ALERT · {topConflict.severity}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">{topConflict.id}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{topConflict.trackLabel}</span>
                <span className="text-slate-600">·</span>
                <span className="text-sky-400">SIMULATED / ML_PREDICTED_SYNTHETIC</span>
              </div>

              <h2 className="font-display text-lg font-semibold text-white">
                {topConflict.followerTrainNo} {topConflict.followerName} closing on{' '}
                {topConflict.leaderTrainNo} {topConflict.leaderName}
              </h2>

              <p className="max-w-3xl text-sm text-slate-300">
                {topConflict.plainSummary}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 font-mono text-xs tabular-nums text-slate-300">
                <span>
                  Net Gap:{' '}
                  <strong className="text-red-300">
                    {topConflict.netGapM.toFixed(1)} m
                  </strong>{' '}
                  (safe {topConflict.safeGapM.toFixed(0)} m)
                </span>
                <span>
                  TTC:{' '}
                  <strong className="text-amber-300">
                    {topConflict.ttcS > 120 ? '>120 s' : `${topConflict.ttcS.toFixed(1)} s`}
                  </strong>
                </span>
                <span>
                  Closing Speed:{' '}
                  <strong>{topConflict.closingVelocityMps.toFixed(1)} m/s</strong>
                </span>
                <span>
                  Block: <strong>B{topConflict.blockIndex + 1}</strong>
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedConflictId(topConflict.id);
                  setActiveView('conflicts');
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3.5 py-2 text-xs font-semibold text-[#040911] transition-colors hover:bg-sky-400"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Investigate (SHAP/LIME)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedConflictId(topConflict.id);
                  setActiveView('dispatch');
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#24395C] bg-[#111D33] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:border-sky-500/60"
              >
                <GitBranch className="h-3.5 w-3.5 text-sky-400" />
                Compare Plans
              </button>
              <button
                type="button"
                onClick={() => setActiveView('twin')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#24395C] bg-[#111D33] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:border-sky-500/60"
              >
                <Box className="h-3.5 w-3.5 text-sky-400" />
                Open Digital Twin
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <div className="font-mono text-xs text-emerald-400">
                  CORRIDOR ENVELOPE NOMINAL · SIMULATED
                </div>
                <h2 className="mt-0.5 font-display text-base font-semibold text-white">
                  All 8 monitored rakes maintaining safe braking separation
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Inject a headway conflict scenario or open Scenario Lab to evaluate SHAP/LIME risk attribution and Baseline vs AI Advisory dispatch plans.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={injectQuickConflict}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3.5 py-2 text-xs font-semibold text-[#040911] hover:bg-sky-400"
              >
                Inject Headway Conflict
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openSecondaryTools('scenarios')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#24395C] bg-[#111D33] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-500/60"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Scenario Lab
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Corridor Situation Strip — 4-Track Horizontal Railway View */}
      <section className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
        <div className="flex flex-col justify-between gap-3 border-b border-[#142038] pb-4 md:flex-row md:items-center">
          <div>
            <div className="font-mono text-[11px] text-sky-400">
              CORRIDOR SITUATION STRIP · SIMULATED 12 KM / 30 BLOCKS
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-white">
              4-Track Trunk Schematic & Live Kinematic Headway
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CloudRain className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-mono text-[11px] text-slate-400">Weather:</span>
            {(['clear', 'rain', 'thunderstorm', 'snow'] as WeatherMode[]).map(
              (w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeather(w)}
                  className={`cursor-pointer rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                    weather === w
                      ? 'border-sky-500/70 bg-sky-500/15 text-sky-200'
                      : 'border-[#1C2C47] bg-[#080E1B] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {w === 'snow' ? 'Fog/Frost' : w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Station markers ruler */}
        <div className="relative mt-4 mb-2 h-7 border-b border-[#142038]">
          {CORRIDOR_STATIONS.map((st) => {
            const leftPct = (st.zM / CORRIDOR_CONFIG.corridorLengthM) * 100;
            return (
              <div
                key={st.code}
                className="absolute top-0 -translate-x-1/2 text-center"
                style={{ left: `${leftPct}%` }}
              >
                <div className="font-mono text-[10px] font-semibold text-sky-300">
                  {st.code}
                </div>
                <div className="font-mono text-[9px] text-slate-500">
                  {(st.zM / 1000).toFixed(1)}km
                </div>
              </div>
            );
          })}
        </div>

        {/* 4 Parallel Tracks */}
        <div className="space-y-3 py-2">
          {[0, 1, 2, 3].map((lineIdx) => {
            const lineTrains = trains
              .filter((t) => t.line === lineIdx)
              .sort((a, b) => a.positionM - b.positionM);
            return (
              <div
                key={lineIdx}
                className="grid grid-cols-1 items-center gap-2 md:grid-cols-[180px_1fr]"
              >
                <div className="font-mono text-[11px] text-slate-400">
                  {CORRIDOR_CONFIG.trackLabels[lineIdx]}
                </div>
                <div className="relative h-14 rounded border border-[#142038] bg-[#060B14]">
                  {/* NDLS Station Throat Highlight Zone (1180m +/- 650m) */}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 bg-amber-500/8"
                    style={{
                      left: `${((CORRIDOR_CONFIG.stationZ - 650) / CORRIDOR_CONFIG.corridorLengthM) * 100}%`,
                      width: `${(1300 / CORRIDOR_CONFIG.corridorLengthM) * 100}%`,
                    }}
                    title="NDLS Station Throat Zone (α = 1.35×)"
                  />
                  {/* Track centerline */}
                  <div className="absolute right-2 left-2 top-1/2 h-[2px] -translate-y-1/2 bg-[#1C2C47]" />

                  {/* Train markers — stagger close pairs vertically so labels never collide */}
                  {lineTrains.map((t, idx) => {
                    const leftPct = Math.min(
                      94,
                      Math.max(5, (t.positionM / CORRIDOR_CONFIG.corridorLengthM) * 100)
                    );
                    const prev = idx > 0 ? lineTrains[idx - 1] : null;
                    const next = idx < lineTrains.length - 1 ? lineTrains[idx + 1] : null;
                    const isCrowded =
                      (prev !== null && Math.abs(t.positionM - prev.positionM) < 1500) ||
                      (next !== null && Math.abs(next.positionM - t.positionM) < 1500);
                    const verticalPos = !isCrowded
                      ? 'top-1/2 -translate-y-1/2'
                      : idx % 2 === 0
                        ? 'top-1'
                        : 'bottom-1';

                    const isSelected = t.id === selectedCorridorTrainId;
                    const colorClass =
                      t.riskLevel === 'DANGER'
                        ? 'border-red-400 bg-[#2A0E14] text-red-200'
                        : t.riskLevel === 'CAUTION'
                          ? 'border-amber-400 bg-[#271C09] text-amber-200'
                          : 'border-sky-400/70 bg-[#0B1C32] text-sky-100';

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedCorridorTrainId(t.id)}
                        style={{ left: `${leftPct}%` }}
                        className={`absolute -translate-x-1/2 cursor-pointer whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-all ${verticalPos} ${colorClass} ${
                          isSelected ? 'ring-2 ring-white/80 z-20' : 'z-10 hover:z-20'
                        }`}
                        title={`${t.trainNo} ${t.name} · ${t.speedKmh} km/h · Gap ${t.netGapM > 900 ? 'Open' : `${t.netGapM}m`}`}
                      >
                        {t.trainNo} ▸
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Train Quick Telemetry Footer */}
        {selectedTrain && (
          <div className="mt-4 flex flex-col justify-between gap-3 border-t border-[#142038] pt-3.5 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <span className="font-semibold text-white">
                {selectedTrain.trainNo} · {selectedTrain.name}
              </span>
              <span className="text-slate-400">
                Pos: {(selectedTrain.positionM / 1000).toFixed(2)} km (Block B
                {selectedTrain.blockIndex + 1})
              </span>
              <span className="text-slate-300">
                Speed: {selectedTrain.speedKmh.toFixed(0)} km/h
              </span>
              <span className="text-slate-300">
                Net Gap:{' '}
                {selectedTrain.netGapM > 900
                  ? 'Open Track'
                  : `${selectedTrain.netGapM.toFixed(1)} m`}
              </span>
              <span className="text-slate-300">
                TTC:{' '}
                {selectedTrain.ttcS > 120
                  ? '>120 s'
                  : `${selectedTrain.ttcS.toFixed(1)} s`}
              </span>
              <span
                className={
                  selectedTrain.riskLevel === 'DANGER'
                    ? 'font-semibold text-red-400'
                    : selectedTrain.riskLevel === 'CAUTION'
                      ? 'font-semibold text-amber-300'
                      : 'text-emerald-400'
                }
              >
                {selectedTrain.riskLevel} · Signal {selectedTrain.signalAspect}
              </span>
            </div>

            <div className="font-mono text-[11px] text-slate-500">
              {WEATHER_PROFILES[weather].adhesionNote}
            </div>
          </div>
        )}
      </section>

      {/* Recent Controller Audit Summary (compact, clean) */}
      {decisions.length > 0 && (
        <section className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] text-sky-400">
                CONTROLLER_DECISION · RECENT AUDIT LOG
              </div>
              <h2 className="mt-0.5 font-display text-base font-semibold text-white">
                Latest Human-in-the-Loop Dispatch Decisions
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openSecondaryTools('history')}
              className="cursor-pointer font-mono text-xs text-sky-400 hover:text-sky-300"
            >
              View full history →
            </button>
          </div>
          <div className="mt-3 divide-y divide-[#142038]">
            {decisions.slice(0, 3).map((d) => (
              <div
                key={d.id}
                className="flex flex-col justify-between gap-2 py-2.5 text-xs md:flex-row md:items-center"
              >
                <div className="flex flex-wrap items-center gap-x-2 font-mono">
                  <span className="font-semibold text-white">{d.trainPair}</span>
                  <span className="text-slate-600">·</span>
                  <span
                    className={
                      d.decision === 'REJECTED_PROPOSAL'
                        ? 'text-red-300'
                        : 'text-emerald-400'
                    }
                  >
                    {d.decision.replaceAll('_', ' ')}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{d.planName}</span>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-400">
                  Gap {d.beforeMetrics.minGapM}m → {d.afterMetrics.minGapM}m · Replay{' '}
                  {d.replayId} · {formatTimeShort(d.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
