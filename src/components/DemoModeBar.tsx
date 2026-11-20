import React from 'react';
import { ArrowRight, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  DEMO_STEPS,
  useControlCentre,
} from '../context/ControlCentreContext.tsx';

export const DemoModeBar: React.FC = () => {
  const { demoStep, nextDemoStep, resetDemoMode, exitDemoMode } =
    useControlCentre();

  if (demoStep === null) return null;
  const current = DEMO_STEPS[demoStep - 1] ?? DEMO_STEPS[0];

  return (
    <aside
      aria-label="Guided Viva Presentation Demo Bar"
      className="fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-5xl rounded-lg border border-amber-500/50 bg-[#0A1324] px-4 py-3 shadow-2xl"
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-amber-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">
              VIVA PRESENTATION MODE · STEP {current.step} OF 8
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              Zero External API Calls · Cached & Simulated
            </span>
          </div>
          <div className="font-display text-sm font-semibold text-white">
            {current.title}
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            {current.talkingPoint}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetDemoMode}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#24395C] bg-[#111D33] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={exitDemoMode}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#24395C] bg-[#111D33] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Live/Cached Mode
          </button>
          <button
            type="button"
            onClick={nextDemoStep}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-[#060B14] transition-colors hover:bg-amber-300"
          >
            <span>{current.actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
