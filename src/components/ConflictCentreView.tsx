import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  GitBranch,
  Info,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import { SCENARIO_PRESETS } from '../engine/kinematics.ts';
import type { MLModelKey } from '../types/railraksha.ts';

export const ConflictCentreView: React.FC = () => {
  const {
    conflicts,
    selectedConflict,
    setSelectedConflictId,
    activeModel,
    setActiveModel,
    activeExplanation,
    xaiViewTab,
    setXaiViewTab,
    loadScenarioPreset,
    setActiveView,
  } = useControlCentre();

  const chartData =
    xaiViewTab === 'lime'
      ? (activeExplanation?.limeAttributions ?? []).slice(0, 8)
      : (activeExplanation?.shapAttributions ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#1C2C47] pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="font-mono text-xs text-sky-400">
            CONFLICT CENTRE · SIMULATED HEADWAY & EXPLAINABLE AI (SHAP / LIME)
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
            Conflict Detection & Explainability Workspace
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            Urgency-sorted simulated headway incidents paired with deterministic braking physics and synthetic-trained SHAP & LIME-style attributions (advisory only).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">Quick Scenarios:</span>
          {SCENARIO_PRESETS.slice(0, 3).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => loadScenarioPreset(preset)}
              className="cursor-pointer rounded border border-[#1C2C47] bg-[#0C1424] px-2.5 py-1.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-sky-500/60 hover:text-white"
            >
              {preset.category === 'headway_conflict'
                ? 'Headway 22416'
                : preset.category === 'station_throat'
                  ? 'NDLS Throat'
                  : 'Monsoon Storm'}
            </button>
          ))}
        </div>
      </section>

      {/* Main Split: Left Conflict Queue | Right Investigation & XAI */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
        {/* Left: Urgency-Sorted Conflict Queue */}
        <section className="rounded-lg border border-[#1C2C47] bg-[#0C1424]">
          <div className="flex items-center justify-between border-b border-[#142038] px-4 py-3">
            <div className="font-mono text-xs font-semibold text-white">
              URGENCY QUEUE ({conflicts.length})
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              Sorted by Severity & TTC
            </span>
          </div>

          {conflicts.length === 0 ? (
            <div className="space-y-3 p-5 text-xs text-slate-400">
              <p>
                No headway conflicts or close-approach pairs (&lt; 260 m) detected in the current simulated corridor.
              </p>
              <button
                type="button"
                onClick={() => loadScenarioPreset(SCENARIO_PRESETS[0])}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3 py-1.5 font-semibold text-[#040911] hover:bg-sky-400"
              >
                <Zap className="h-3.5 w-3.5" />
                Load 22416 Headway Conflict
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#142038]">
              {conflicts.map((inc) => {
                const active = selectedConflict?.id === inc.id;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => setSelectedConflictId(inc.id)}
                    className={`w-full cursor-pointer p-4 text-left transition-colors ${
                      active ? 'bg-[#12203A]' : 'hover:bg-[#0F1A2E]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span
                        className={`font-semibold ${
                          inc.severity === 'DANGER'
                            ? 'text-red-400'
                            : inc.severity === 'CAUTION'
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                        }`}
                      >
                        {inc.severity} · {inc.id}
                      </span>
                      <span className="text-slate-400">{inc.reviewStatus}</span>
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-white">
                      {inc.followerTrainNo} → {inc.leaderTrainNo}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {inc.trackLabel} · Block B{inc.blockIndex + 1} · {inc.weather}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-slate-300">
                      <span>Gap: {inc.netGapM.toFixed(1)} m</span>
                      <span>
                        TTC: {inc.ttcS > 120 ? '>120 s' : `${inc.ttcS.toFixed(1)} s`}
                      </span>
                      <span>Δv: {inc.closingVelocityMps.toFixed(1)} m/s</span>
                      <span className="text-sky-400">
                        ML: {inc.modelRiskClass}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Detailed Investigation + SHAP / LIME Explainability */}
        <section className="space-y-5">
          {selectedConflict && activeExplanation ? (
            <>
              {/* Plain-Language "Why is this train at risk?" Card */}
              <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px]">
                      <ShieldAlert
                        className={`h-3.5 w-3.5 ${
                          selectedConflict.severity === 'DANGER'
                            ? 'text-red-400'
                            : selectedConflict.severity === 'CAUTION'
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                        }`}
                      />
                      <span className="font-semibold text-white">
                        WHY IS TRAIN {selectedConflict.followerTrainNo} AT RISK?
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-sky-400">ML_PREDICTED_SYNTHETIC</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">Advisory Only</span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-200">
                      {activeExplanation.plainExplanation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveView('dispatch')}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3.5 py-2 text-xs font-semibold text-[#040911] hover:bg-sky-400"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Compare Dispatch Plans
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Top 3 Key Contributing Factors */}
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {activeExplanation.top3Factors.map((factor, idx) => (
                    <div
                      key={factor.feature}
                      className="rounded border border-[#142038] bg-[#070D19] p-3"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>FACTOR #{idx + 1}</span>
                        <span
                          className={
                            factor.direction === 'INCREASES_RISK'
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }
                        >
                          {factor.contribution >= 0 ? '+' : ''}
                          {factor.contribution.toFixed(3)} φ
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {factor.label}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-sky-300">
                        {factor.displayValue}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Deterministic Physics Thresholds & Counterfactual No-AI Warning */}
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#142038] pt-4 lg:grid-cols-2">
                  <div className="rounded border border-[#142038] bg-[#070D19] p-3.5 text-xs">
                    <div className="font-mono text-[11px] font-semibold text-sky-400">
                      DETERMINISTIC PHYSICS FALLBACK · SIMULATED
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-y-1 font-mono text-[11px] tabular-nums text-slate-300">
                      <span>Rule Classification:</span>
                      <strong className="text-white">
                        {activeExplanation.deterministicClass}
                      </strong>
                      <span>Danger Thresholds:</span>
                      <span>
                        Gap &lt;= {activeExplanation.physicsThresholds.dangerGapM}m or TTC &lt;={' '}
                        {activeExplanation.physicsThresholds.dangerTtcS}s
                      </span>
                      <span>Caution Thresholds:</span>
                      <span>
                        Gap &lt;= {activeExplanation.physicsThresholds.cautionGapM}m or TTC &lt;={' '}
                        {activeExplanation.physicsThresholds.cautionTtcS}s
                      </span>
                      <span>Throat × Weather:</span>
                      <span>
                        {activeExplanation.physicsThresholds.throatAlpha}× ·{' '}
                        {activeExplanation.physicsThresholds.weatherBeta}× ={' '}
                        {activeExplanation.physicsThresholds.combinedFactor}×
                      </span>
                    </div>
                  </div>

                  <div className="rounded border border-[#142038] bg-[#070D19] p-3.5 text-xs">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      COUNTERFACTUAL (NO AI INTERVENTION · 20s HORIZON)
                    </div>
                    <p className="mt-1.5 leading-relaxed text-slate-300">
                      {selectedConflict.counterfactualNoAI.summary}
                    </p>
                    <div className="mt-2 font-mono text-[11px] tabular-nums text-slate-400">
                      Braking-Aware Safe Gap: {selectedConflict.safeGapM.toFixed(1)} m ·
                      Est. Reactive Delay: +{selectedConflict.counterfactualNoAI.projectedDelayMin} min
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical XAI Panel: Model Switcher + SHAP & LIME Charts */}
              <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
                <div className="flex flex-col justify-between gap-3 border-b border-[#142038] pb-4 md:flex-row md:items-center">
                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-400">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>
                        {activeExplanation.modelDisplayName} · Confidence{' '}
                        {(activeExplanation.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <h2 className="mt-0.5 font-display text-base font-semibold text-white">
                      Feature Attribution Explorer (SHAP & LIME-Style Surrogate)
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Model selector */}
                    <div className="flex items-center rounded border border-[#1C2C47] bg-[#070D19] p-0.5 font-mono text-[11px]">
                      {(
                        [
                          { id: 'xgboost', label: 'XGBoost' },
                          { id: 'catboost', label: 'CatBoost' },
                          { id: 'random_forest', label: 'Random Forest' },
                        ] as Array<{ id: MLModelKey; label: string }>
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setActiveModel(m.id)}
                          className={`cursor-pointer rounded px-2.5 py-1 ${
                            activeModel === m.id
                              ? 'bg-[#162542] text-sky-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* SHAP vs LIME vs Plain selector */}
                    <div className="flex items-center rounded border border-[#1C2C47] bg-[#070D19] p-0.5 font-mono text-[11px]">
                      {(
                        [
                          { id: 'plain', label: 'SHAP Overview' },
                          { id: 'shap', label: 'SHAP Exact' },
                          { id: 'lime', label: 'LIME Local' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setXaiViewTab(tab.id)}
                          className={`cursor-pointer rounded px-2.5 py-1 ${
                            xaiViewTab === tab.id
                              ? 'bg-sky-500/20 text-sky-200'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Class Probability Readout */}
                <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-xs tabular-nums">
                  {(['DANGER', 'CAUTION', 'CLEAR'] as const).map((cls) => {
                    const pct = Math.round(
                      (activeExplanation.probabilities[cls] ?? 0) * 100
                    );
                    const barColor =
                      cls === 'DANGER'
                        ? 'bg-red-500'
                        : cls === 'CAUTION'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500';
                    return (
                      <div
                        key={cls}
                        className="rounded border border-[#142038] bg-[#070D19] p-2.5"
                      >
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">{cls}</span>
                          <span className="font-semibold text-white">{pct}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-sm bg-[#142038]">
                          <div
                            className={`h-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Horizontal Attribution Chart */}
                <div className="mt-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 20, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#142038" />
                      <XAxis
                        type="number"
                        tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        stroke="#1C2C47"
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={165}
                        tick={{ fill: '#CBD5E1', fontSize: 11 }}
                        stroke="#1C2C47"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#080F1D',
                          borderColor: '#1C2C47',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono',
                        }}
                        formatter={(value: unknown) => [
                          `${Number(value).toFixed(4)} (${xaiViewTab === 'lime' ? 'LIME weight' : 'SHAP φ'})`,
                          'Impact',
                        ]}
                      />
                      <ReferenceLine x={0} stroke="#475569" />
                      <Bar dataKey="contribution" radius={[2, 2, 2, 2]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.feature}
                            fill={
                              entry.contribution >= 0 ? '#EF4444' : '#10B981'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Dataset Caveats & Limitations */}
                <div className="mt-4 rounded border border-[#142038] bg-[#070D19] p-3.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-200">
                    <Info className="h-3.5 w-3.5 text-sky-400" />
                    <span>
                      SYNTHETIC TRAINING PROVENANCE & LIMITATIONS (LIME Local R²:{' '}
                      {activeExplanation.limeLocalR2.toFixed(2)})
                    </span>
                  </div>
                  <p className="mt-1">{activeExplanation.datasetNote}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                    {activeExplanation.limitations.map((lim) => (
                      <li key={lim}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-8 text-center">
              <p className="text-sm text-slate-300">
                Select a conflict from the urgency queue or load a headway conflict preset to inspect SHAP & LIME explanations.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
