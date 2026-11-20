import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Box,
  GitBranch,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import type { PrimaryView } from '../types/railraksha.ts';

const NAV_ITEMS: Array<{
  id: PrimaryView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'monitor', label: 'Train Monitor', icon: TrainFront },
  { id: 'conflicts', label: 'Conflict Centre', icon: AlertTriangle },
  { id: 'dispatch', label: 'AI Dispatch', icon: GitBranch },
  { id: 'twin', label: 'Digital Twin', icon: Box },
];

export const TopNav: React.FC = () => {
  const {
    activeView,
    setActiveView,
    conflicts,
    openSecondaryTools,
    assistantOpen,
    setAssistantOpen,
    demoStep,
    startDemoMode,
    exitDemoMode,
  } = useControlCentre();

  const urgentCount = conflicts.filter((c) => c.severity !== 'CLEAR').length;

  return (
    <header className="sticky top-0 z-30 border-b border-[#1C2C47] bg-[#060B14]/95">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveView('overview')}
          className="flex cursor-pointer items-center gap-2.5 text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-sky-500/40 bg-[#0C1424] font-display text-xs font-bold text-sky-400">
            RR
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight text-white">
              RailRaksha
            </div>
            <div className="hidden font-mono text-[10px] text-slate-400 sm:block">
              SIH-25022 · Control Centre
            </div>
          </div>
        </button>

        {/* Zone 2: Strictly 5 Primary Navigation Destinations (Desktop) */}
        <nav
          aria-label="Primary Control Centre Navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#111D33] text-sky-300'
                    : 'text-slate-400 hover:bg-[#0C1424] hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'conflicts' && urgentCount > 0 && (
                  <span className="ml-0.5 font-mono text-[11px] font-semibold tabular-nums text-red-400">
                    ({urgentCount})
                  </span>
                )}
                {active && (
                  <span className="absolute right-2 bottom-0 left-2 h-[2px] bg-sky-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Compact Utility Actions (Demo, Assistant, Tools) */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={demoStep !== null ? exitDemoMode : startDemoMode}
            className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              demoStep !== null
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                : 'border-[#1C2C47] bg-[#0C1424] text-slate-300 hover:border-sky-500/50 hover:text-white'
            }`}
            title="Start or exit 8-step Viva Presentation Mode"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">
              {demoStep !== null ? `Viva Step ${demoStep}/8` : 'Viva Demo'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAssistantOpen(!assistantOpen)}
            className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              assistantOpen
                ? 'border-sky-500/70 bg-sky-500/15 text-sky-200'
                : 'border-[#1C2C47] bg-[#0C1424] text-slate-300 hover:border-sky-500/50 hover:text-white'
            }`}
            title="RailRaksha Intelligence Assistant"
          >
            <Bot className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden md:inline">Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => openSecondaryTools('timetable')}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-[#1C2C47] bg-[#0C1424] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/50 hover:text-white"
            title="Secondary Controller Tools: Timetable, Scenario Lab, History, Models, Health"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Tools</span>
          </button>
        </div>
      </div>

      {/* Mobile Primary Navigation Bar (all 5 destinations accessible on small screens) */}
      <nav
        aria-label="Mobile Primary Navigation"
        className="flex items-center gap-1 overflow-x-auto border-t border-[#142038] bg-[#070D1A] px-3 py-1.5 md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium ${
                active
                  ? 'bg-[#12203A] text-sky-300'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
              {item.id === 'conflicts' && urgentCount > 0 && (
                <span className="font-mono text-[10px] font-semibold text-red-400">
                  ({urgentCount})
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Slim Academic Scope & System Strip */}
      <div className="border-t border-[#142038] bg-[#080E1B]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 font-mono text-[11px] text-slate-400 md:px-6">
          <div className="flex flex-wrap items-center gap-x-2">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span className="text-slate-300">Academic Decision-Support Prototype</span>
            <span className="text-slate-600">·</span>
            <span>Not Certified SIL-4 / Kavach Signalling</span>
            <span className="text-slate-600">·</span>
            <span>The NorthCap University (SIH-25022)</span>
          </div>
          <div className="flex items-center gap-x-2 text-slate-400">
            <button
              type="button"
              onClick={() => openSecondaryTools('models')}
              className="cursor-pointer hover:text-sky-300"
            >
              Model Diagnostics
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => openSecondaryTools('scenarios')}
              className="cursor-pointer hover:text-sky-300"
            >
              Scenario Lab
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => openSecondaryTools('health')}
              className="cursor-pointer hover:text-sky-300"
            >
              Quota & Health
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
