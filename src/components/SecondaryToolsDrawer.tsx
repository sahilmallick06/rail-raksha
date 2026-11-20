import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  FlaskConical,
  History,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import {
  MODEL_BENCHMARK_TABLES,
  SCENARIO_PRESETS,
} from '../engine/kinematics.ts';
import type { SecondaryToolTab } from '../types/railraksha.ts';

const TABS: Array<{
  id: SecondaryToolTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'timetable', label: 'Timetable & Gantt', icon: Clock },
  { id: 'scenarios', label: 'Scenario Lab', icon: FlaskConical },
  { id: 'history', label: 'Decision History', icon: History },
  { id: 'models', label: 'Model Diagnostics', icon: BarChart3 },
  { id: 'health', label: 'System Health & Quota', icon: Activity },
];

export const SecondaryToolsDrawer: React.FC = () => {
  const {
    secondaryToolsOpen,
    secondaryToolsTab,
    openSecondaryTools,
    closeSecondaryTools,
    trains,
    decisions,
    loadScenarioPreset,
    setActiveView,
    quota,
    healthData,
    replayIntro,
  } = useControlCentre();

  const [benchmarkTab, setBenchmarkTab] = useState<'bundled' | 'paper'>(
    'bundled'
  );

  if (!secondaryToolsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65"
      onClick={closeSecondaryTools}
    >
      <aside
        className="flex h-full w-full max-w-4xl flex-col border-l border-[#1C2C47] bg-[#080F1D]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1C2C47] px-5 py-4">
          <div>
            <div className="font-mono text-[11px] text-sky-400">
              SECONDARY CONTROLLER TOOLS · SIH-25022
            </div>
            <h2 className="font-display text-lg font-bold text-white">
              Diagnostics, Scenarios, Timetable & Audit History
            </h2>
          </div>
          <button
            type="button"
            onClick={closeSecondaryTools}
            className="cursor-pointer rounded border border-[#1C2C47] p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tool Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#142038] bg-[#060B14] px-4 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = secondaryToolsTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openSecondaryTools(t.id)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium ${
                  active
                    ? 'bg-[#12203A] text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* 1. Timetable & Gantt */}
          {secondaryToolsTab === 'timetable' && (
            <div className="space-y-4">
              <div className="font-mono text-[11px] text-slate-400">
                TIMETABLE & CORRIDOR PROGRESSION · SIMULATED 12 KM SECTION
              </div>
              <div className="space-y-3 rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
                {trains.map((t) => {
                  const pct = Math.min(100, Math.round((t.positionM / 12000) * 100));
                  return (
                    <div key={t.id} className="space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-semibold text-white">
                          {t.trainNo} · {t.name}
                        </span>
                        <span className="tabular-nums text-slate-400">
                          Dep {t.depTime} · Arr {t.arrTime} · Delay +{t.delayMin}m ·{' '}
                          {pct}% section
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-sm bg-[#060B14]">
                        <div
                          className={`h-full ${
                            t.riskLevel === 'DANGER'
                              ? 'bg-red-500'
                              : t.riskLevel === 'CAUTION'
                                ? 'bg-amber-400'
                                : 'bg-sky-500'
                          }`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Scenario Lab */}
          {secondaryToolsTab === 'scenarios' && (
            <div className="space-y-4">
              <div className="font-mono text-[11px] text-slate-400">
                REPRODUCIBLE CONTROLLER SCENARIOS · SIMULATED CORRIDOR (0 EXTERNAL QUOTA)
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SCENARIO_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex flex-col justify-between rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-sky-400">{preset.id}</span>
                        <span
                          className={
                            preset.expectedSeverity === 'DANGER'
                              ? 'text-red-400'
                              : preset.expectedSeverity === 'CAUTION'
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                          }
                        >
                          {preset.expectedSeverity} · {preset.weather.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 font-display text-sm font-semibold text-white">
                        {preset.name}
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-400">
                        {preset.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        loadScenarioPreset(preset);
                        closeSecondaryTools();
                        setActiveView('conflicts');
                      }}
                      className="mt-3 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-sky-500/45 bg-sky-500/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
                    >
                      <Play className="h-3 w-3" />
                      Load & Inspect in Conflict Centre
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Decision History */}
          {secondaryToolsTab === 'history' && (
            <div className="space-y-4">
              <div className="font-mono text-[11px] text-slate-400">
                CONTROLLER_DECISION AUDIT LOG ({decisions.length} RECORDED)
              </div>
              {decisions.length === 0 ? (
                <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-6 text-center text-slate-400">
                  No controller decisions recorded yet. Approve, modify, or reject an advisory plan in AI Dispatch to populate the audit trail.
                </div>
              ) : (
                <div className="space-y-3">
                  {decisions.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="font-semibold text-white">
                          {d.id} · {d.trainPair}
                        </span>
                        <span
                          className={
                            d.decision === 'REJECTED_PROPOSAL'
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }
                        >
                          {d.decision.replaceAll('_', ' ')} · Replay {d.replayId}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-300">
                        {d.planName} ({d.planVersion}) · Reason: {d.reasonCode}
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400">
                        Before → After: Min Gap {d.beforeMetrics.minGapM}m →{' '}
                        {d.afterMetrics.minGapM}m · Conflicts{' '}
                        {d.beforeMetrics.activeConflicts} →{' '}
                        {d.afterMetrics.activeConflicts} · Total Delay{' '}
                        {d.beforeMetrics.totalDelayMin}m →{' '}
                        {d.afterMetrics.totalDelayMin}m
                      </div>
                      {d.controllerNote && (
                        <div className="mt-1.5 text-slate-400">
                          Note: “{d.controllerNote}”
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Model Diagnostics — Strictly separating Bundled 6,480 vs Paper 3,600 */}
          {secondaryToolsTab === 'models' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-sky-400">
                    ML_PREDICTED_SYNTHETIC · BENCHMARK TRANSPARENCY
                  </div>
                  <p className="mt-0.5 text-slate-400">
                    Research paper 11-model benchmarks and bundled 3-model synthetic evaluation are kept strictly distinct.
                  </p>
                </div>
                <div className="flex rounded border border-[#1C2C47] bg-[#060B14] p-0.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBenchmarkTab('bundled')}
                    className={`cursor-pointer rounded px-2.5 py-1 ${
                      benchmarkTab === 'bundled'
                        ? 'bg-[#12203A] text-sky-300'
                        : 'text-slate-400'
                    }`}
                  >
                    Bundled 3-Model (6,480 rows)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBenchmarkTab('paper')}
                    className={`cursor-pointer rounded px-2.5 py-1 ${
                      benchmarkTab === 'paper'
                        ? 'bg-[#12203A] text-sky-300'
                        : 'text-slate-400'
                    }`}
                  >
                    Paper 11-Model (3,600 frames)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#1C2C47] bg-[#0C1424]">
                <table className="w-full border-collapse text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-[#1C2C47] bg-[#060B14] text-slate-400">
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5">Accuracy</th>
                      <th className="px-3 py-2.5">Macro F1</th>
                      <th className="px-3 py-2.5">
                        {benchmarkTab === 'bundled'
                          ? 'Missed / False DANGER'
                          : 'Brier / R²'}
                      </th>
                      <th className="px-3 py-2.5">Scope & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142038] tabular-nums">
                    {(benchmarkTab === 'bundled'
                      ? MODEL_BENCHMARK_TABLES.bundled6480
                      : MODEL_BENCHMARK_TABLES.researchPaper3600
                    ).map((row) => (
                      <tr key={row.model}>
                        <td className="px-3 py-2 font-semibold text-white">
                          {row.model}
                        </td>
                        <td className="px-3 py-2 text-sky-300">
                          {(row.accuracy * 100).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-emerald-300">
                          {row.macroF1.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {benchmarkTab === 'bundled'
                            ? `${row.missedDanger ?? 0} / ${row.falseDanger ?? 0}`
                            : row.brierScore
                              ? `${row.brierScore} / ${row.r2Score}`
                              : '—'}
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-400">
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Global SHAP Importance Chart (Research Paper) */}
              <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
                <div className="font-mono text-[11px] text-sky-400">
                  GLOBAL SHAP MEAN |φ| · RESEARCH PAPER BENCHMARK
                </div>
                <div className="mt-3 h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={MODEL_BENCHMARK_TABLES.globalShapPaper}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#142038" />
                      <XAxis
                        type="number"
                        tick={{ fill: '#94A3B8', fontSize: 10 }}
                        stroke="#1C2C47"
                      />
                      <YAxis
                        type="category"
                        dataKey="feature"
                        width={165}
                        tick={{ fill: '#CBD5E1', fontSize: 10 }}
                        stroke="#1C2C47"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#080F1D',
                          borderColor: '#1C2C47',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      <Bar
                        dataKey="meanAbsShap"
                        name="Mean |SHAP|"
                        fill="#38BDF8"
                        radius={[2, 2, 2, 2]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 5. System Health & Quota */}
          {secondaryToolsTab === 'health' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
                  <div className="font-mono text-[11px] font-semibold text-sky-400">
                    RAILRADAR QUOTA SAFEGUARDS
                  </div>
                  <div className="mt-3 space-y-1.5 font-mono text-xs tabular-nums text-slate-300">
                    <div>
                      Daily Calls: {quota?.dailyUsed ?? 0} / {quota?.dailyLimit ?? 12}
                    </div>
                    <div>
                      Monthly Calls: {quota?.monthlyUsed ?? 0} /{' '}
                      {quota?.monthlyLimit ?? 240}
                    </div>
                    <div>
                      Fresh Cache TTL: {quota?.freshCacheMinutes ?? 30} minutes
                    </div>
                    <div>
                      Stale Fallback Window: {quota?.staleCacheDays ?? 7} days
                    </div>
                    <div>
                      Max Manual Fleet Refresh: {quota?.maxFleetRefreshTrains ?? 3}{' '}
                      trains
                    </div>
                    <div>
                      Suppressed Duplicates: {quota?.totalSuppressedDuplicates ?? 0}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
                  <div className="font-mono text-[11px] font-semibold text-sky-400">
                    BACKEND SUBSYSTEMS
                  </div>
                  <div className="mt-3 space-y-1.5 font-mono text-xs text-slate-300">
                    {Object.entries(
                      (healthData?.subsystems as Record<string, string>) ?? {
                        kinematicEngine: 'ONLINE',
                        syntheticMlExplainer: 'ONLINE',
                        railradarGateway: 'CACHED_ONLY_NO_KEY',
                      }
                    ).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-emerald-400">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project & Team Attribution + Replay Intro */}
              <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <div className="font-mono text-[11px] font-semibold text-white">
                      SIH-25022 · THE NORTHCAP UNIVERSITY, GURUGRAM
                    </div>
                    <p className="mt-1 text-slate-400">
                      Mentors: Dr. Nidhi Malik, Dr. Manvi Breja · Team: Sahil Mallick (23CSU271), Saiyam Taneja (23CSU273), Sarthak Sabharwal (23CSU284).
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Academic decision-support prototype only. Never intended to substitute certified SIL-4 railway signalling or Kavach ATP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={replayIntro}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/10 px-3 py-2 font-mono text-xs text-sky-200 hover:bg-sky-500/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Replay 3D Intro
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
