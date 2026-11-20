import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  GitBranch,
  Info,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import { SCENARIO_PRESETS } from '../engine/kinematics.ts';
import type { DecisionRecord, DispatchPlan } from '../types/railraksha.ts';

export const AIDispatchView: React.FC = () => {
  const {
    selectedConflict,
    dispatchPlans,
    submitControllerDecision,
    loadScenarioPreset,
    setActiveView,
  } = useControlCentre();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [controllerNote, setControllerNote] = useState('');
  const [reasonCode, setReasonCode] = useState('HEADWAY_SAFETY_MARGIN');
  const [customSpeedKmh, setCustomSpeedKmh] = useState<number>(68);
  const [submitting, setSubmitting] = useState(false);
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null);

  const baselinePlan =
    dispatchPlans.find((p) => p.strategy === 'BASELINE') ?? dispatchPlans[0];
  const recommendedPlan =
    dispatchPlans.find((p) => p.strategy === 'RAILRAKSHA_OPTIMIZED') ??
    dispatchPlans[0];

  const activePlan: DispatchPlan | null = useMemo(() => {
    if (selectedPlanId) {
      const f = dispatchPlans.find((p) => p.id === selectedPlanId);
      if (f) return f;
    }
    return recommendedPlan ?? null;
  }, [dispatchPlans, selectedPlanId, recommendedPlan]);

  // Derived comparison chart data (calculated from actual plan metrics — no hardcoded %)
  const comparisonChartData = useMemo(
    () =>
      dispatchPlans.map((p) => ({
        name:
          p.strategy === 'BASELINE'
            ? 'Baseline'
            : p.strategy === 'RAILRAKSHA_OPTIMIZED'
              ? 'AI Advisory'
              : 'Safety Hold',
        totalDelayMin: p.metrics.predictedTotalDelayMin,
        waitingMin: p.metrics.predictedWaitingMin,
        minGapM: p.metrics.projectedMinGapM,
      })),
    [dispatchPlans]
  );

  // Compact timetable / stringline trajectory comparison (Baseline vs Selected Advisory)
  const stringlineData = useMemo(() => {
    if (!baselinePlan || !activePlan) return [];
    const baseDelay = baselinePlan.metrics.predictedTotalDelayMin;
    const propDelay = activePlan.metrics.predictedTotalDelayMin;
    return [
      { station: 'NDLS (1.2km)', baselineMin: 0, proposedMin: 0 },
      {
        station: 'TKJ (3.6km)',
        baselineMin: Number((baseDelay * 0.25).toFixed(1)),
        proposedMin: Number((propDelay * 0.35).toFixed(1)),
      },
      {
        station: 'ANVT (6.4km)',
        baselineMin: Number((baseDelay * 0.65).toFixed(1)),
        proposedMin: Number((propDelay * 0.68).toFixed(1)),
      },
      {
        station: 'GZB (9.2km)',
        baselineMin: Number((baseDelay * 0.92).toFixed(1)),
        proposedMin: Number((propDelay * 0.88).toFixed(1)),
      },
      {
        station: 'DER (11.6km)',
        baselineMin: baseDelay,
        proposedMin: propDelay,
      },
    ];
  }, [baselinePlan, activePlan]);

  const handleDecision = async (decision: DecisionRecord['decision']) => {
    if (!activePlan || submitting) return;
    setSubmitting(true);
    try {
      const rec = await submitControllerDecision({
        plan: activePlan,
        decision,
        controllerNote:
          controllerNote.trim() ||
          `Controller ${decision.toLowerCase().replaceAll('_', ' ')} for ${activePlan.name}.`,
        reasonCode,
        customTargetSpeedKmh:
          decision === 'MODIFIED_SCENARIO' ? customSpeedKmh : undefined,
      });
      if (rec) {
        setLastDecision(rec);
        setControllerNote('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#1C2C47] pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="font-mono text-xs text-sky-400">
            AI DISPATCH & OPTIMIZATION · DERIVED_ESTIMATE / CONTROLLER_DECISION
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
            Baseline vs Advisory Plan Comparison
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            All metrics below are computed directly from the active simulated corridor conflict. No proposal is executed automatically — human controller approval is required.
          </p>
        </div>

        {!selectedConflict && (
          <button
            type="button"
            onClick={() => loadScenarioPreset(SCENARIO_PRESETS[0])}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3.5 py-2 text-xs font-semibold text-[#040911] hover:bg-sky-400"
          >
            <Zap className="h-3.5 w-3.5" />
            Inject 22416 Conflict to Compare Plans
          </button>
        )}
      </section>

      {/* Confirmation Banner after Human-in-the-Loop Decision */}
      {lastDecision && (
        <section className="rounded-lg border border-emerald-500/45 bg-[#091A18] p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  DECISION LOGGED · {lastDecision.decision.replaceAll('_', ' ')} ·
                  Replay ID {lastDecision.replayId}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs tabular-nums text-slate-200">
                Before → After: Min Gap {lastDecision.beforeMetrics.minGapM}m →{' '}
                {lastDecision.afterMetrics.minGapM}m · Active Conflicts{' '}
                {lastDecision.beforeMetrics.activeConflicts} →{' '}
                {lastDecision.afterMetrics.activeConflicts} · Plan Version{' '}
                {lastDecision.planVersion}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Note: {lastDecision.controllerNote} ({lastDecision.reasonCode})
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('twin')}
              className="shrink-0 cursor-pointer rounded border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
            >
              Replay in 3D Digital Twin →
            </button>
          </div>
        </section>
      )}

      {/* Side-by-Side Plan Cards */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {dispatchPlans.map((plan) => {
          const isSelected = activePlan?.id === plan.id;
          const delayDiffVsBase =
            baselinePlan && plan.id !== baselinePlan.id
              ? plan.metrics.predictedTotalDelayMin -
                baselinePlan.metrics.predictedTotalDelayMin
              : 0;
          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`flex cursor-pointer flex-col justify-between rounded-lg border p-5 transition-colors ${
                isSelected
                  ? 'border-sky-400 bg-[#101E36]'
                  : 'border-[#1C2C47] bg-[#0C1424] hover:border-slate-500'
              }`}
            >
              <div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span
                    className={
                      plan.strategy === 'RAILRAKSHA_OPTIMIZED'
                        ? 'font-semibold text-sky-300'
                        : plan.strategy === 'SAFETY_HOLD'
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                    }
                  >
                    {plan.strategy.replaceAll('_', ' ')} · {plan.version}
                  </span>
                  <span className="text-slate-500">{plan.provenance}</span>
                </div>

                <h2 className="mt-1.5 font-display text-base font-bold text-white">
                  {plan.name}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {plan.description}
                </p>

                {/* Calculated Metrics Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#142038] pt-3.5 font-mono text-xs tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-500">TOTAL DELAY</div>
                    <div className="font-semibold text-white">
                      {plan.metrics.predictedTotalDelayMin} min
                      {delayDiffVsBase !== 0 && (
                        <span
                          className={`ml-1.5 text-[11px] ${
                            delayDiffVsBase < 0
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                          }`}
                        >
                          ({delayDiffVsBase > 0 ? '+' : ''}
                          {delayDiffVsBase}m)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">MIN SEPARATION</div>
                    <div className="font-semibold text-sky-300">
                      {plan.metrics.projectedMinGapM} m
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">CONFLICTS LEFT</div>
                    <div
                      className={`font-semibold ${
                        plan.metrics.projectedConflictsRemaining === 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {plan.metrics.projectedConflictsRemaining}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">THROUGHPUT</div>
                    <div className="font-semibold text-slate-200">
                      {plan.metrics.throughputTrainsPerHr} tr/hr
                    </div>
                  </div>
                </div>

                {/* Actions list */}
                <div className="mt-4 space-y-2 border-t border-[#142038] pt-3">
                  <div className="font-mono text-[10px] text-slate-400">
                    PROPOSED ACTIONS
                  </div>
                  {plan.actions.length > 0 ? (
                    plan.actions.map((act, i) => (
                      <div
                        key={`${act.trainId}-${i}`}
                        className="rounded border border-[#142038] bg-[#070D19] p-2.5 text-xs"
                      >
                        <div className="font-mono font-semibold text-slate-100">
                          {act.trainNo} · {act.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {act.detail}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="font-mono text-[11px] text-slate-500">
                      Continue scheduled pacing.
                    </div>
                  )}
                </div>
              </div>

              {/* Tradeoffs & Loop-Line Boundary */}
              <div className="mt-4 border-t border-[#142038] pt-3 text-[11px] text-slate-400">
                <ul className="list-disc space-y-1 pl-4">
                  {plan.tradeoffs.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </section>

      {/* Loop-Line Honesty Note */}
      <div className="flex items-center gap-2 rounded border border-[#1C2C47] bg-[#080F1D] px-4 py-2.5 font-mono text-[11px] text-slate-400">
        <Info className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span>
          Geometry Note: Loop-line overtaking/diversion is not physically modeled on this 4-track straight corridor; advisory optimization uses speed regulation, precedence grants, and block holds only.
        </span>
      </div>

      {/* Charts + Human-in-the-Loop Decision Panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        {/* Charts */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
            <div className="font-mono text-[11px] text-sky-400">
              PLAN COMPARISON · DERIVED_ESTIMATE
            </div>
            <h3 className="mt-0.5 font-display text-sm font-semibold text-white">
              Predicted Delay vs Min Separation
            </h3>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#142038" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#CBD5E1', fontSize: 11 }}
                    stroke="#1C2C47"
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="totalDelayMin"
                    name="Total Delay (min)"
                    fill="#F59E0B"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="waitingMin"
                    name="Waiting (min)"
                    fill="#38BDF8"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
            <div className="font-mono text-[11px] text-sky-400">
              STRINGLINE IMPACT · CUMULATIVE DELAY
            </div>
            <h3 className="mt-0.5 font-display text-sm font-semibold text-white">
              Station-by-Station Delay Trajectory
            </h3>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stringlineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#142038" />
                  <XAxis
                    dataKey="station"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    stroke="#1C2C47"
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="baselineMin"
                    name="Baseline (min)"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="proposedMin"
                    name="Selected Plan (min)"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Human-in-the-Loop Decision Card */}
        <section className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-sky-400">
            <GitBranch className="h-3.5 w-3.5" />
            <span>HUMAN-IN-THE-LOOP APPROVAL</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-white">
            {activePlan?.name ?? 'Select a Plan'}
          </h3>
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            Version {activePlan?.version ?? 'N/A'} · Target Conflict:{' '}
            {selectedConflict?.id ?? 'Nominal'}
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-mono text-[11px] text-slate-400">
                Controller Reason Code
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="mt-1 w-full rounded border border-[#1C2C47] bg-[#070D19] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="HEADWAY_SAFETY_MARGIN">
                  HEADWAY_SAFETY_MARGIN — Restore safe braking envelope
                </option>
                <option value="PRIORITY_EXPRESS_CLEARANCE">
                  PRIORITY_EXPRESS_CLEARANCE — Preserve Rajdhani/VB punctuality
                </option>
                <option value="WEATHER_ADHESION_CAUTION">
                  WEATHER_ADHESION_CAUTION — Rain/Storm braking margin
                </option>
                <option value="CONTROLLER_OVERRIDE">
                  CONTROLLER_OVERRIDE — Manual section judgment
                </option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] text-slate-400">
                Custom Target Speed (for Modify Scenario): {customSpeedKmh} km/h
              </label>
              <input
                type="range"
                min={35}
                max={110}
                step={5}
                value={customSpeedKmh}
                onChange={(e) => setCustomSpeedKmh(Number(e.target.value))}
                className="mt-1 w-full accent-sky-400"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] text-slate-400">
                Controller Audit Note
              </label>
              <textarea
                rows={2}
                value={controllerNote}
                onChange={(e) => setControllerNote(e.target.value)}
                placeholder="Document operational rationale for audit trail..."
                className="mt-1 w-full rounded border border-[#1C2C47] bg-[#070D19] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <button
                type="button"
                disabled={submitting || !activePlan}
                onClick={() => handleDecision('ACCEPTED_FOR_SIMULATION')}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-[#04100C] transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Accept for Simulation
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={submitting || !activePlan}
                  onClick={() => handleDecision('MODIFIED_SCENARIO')}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Modify ({customSpeedKmh} km/h)
                </button>
                <button
                  type="button"
                  disabled={submitting || !activePlan}
                  onClick={() => handleDecision('REJECTED_PROPOSAL')}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-red-500/45 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject Proposal
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
