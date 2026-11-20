import React, { useState } from 'react';
import {
  Box,
  Camera,
  CloudRain,
  Eye,
  EyeOff,
  Radio,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import { CORRIDOR_CONFIG, WEATHER_PROFILES } from '../engine/kinematics.ts';
import type { WeatherMode } from '../types/railraksha.ts';

export const DigitalTwinView: React.FC = () => {
  const {
    trains,
    weather,
    setWeather,
    twinConnected,
    lastTwinSyncAt,
    sendTwinCommand,
    twinIframeRef,
    injectQuickConflict,
    resetCorridor,
  } = useControlCentre();

  const [embedActive, setEmbedActive] = useState(true);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#1C2C47] pb-4 lg:flex-row lg:items-end">
        <div>
          <div className="font-mono text-xs text-sky-400">
            DIGITAL TWIN · BABYLON.JS RESEARCH V2 · BROADCASTCHANNEL: railraksha-live-v3
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
            3D Corridor Digital Twin Simulator
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs text-slate-400">
            <Radio
              className={`h-3.5 w-3.5 ${
                twinConnected ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span>
              Bridge Status:{' '}
              <strong
                className={twinConnected ? 'text-emerald-400' : 'text-slate-300'}
              >
                {twinConnected ? 'Connected (Live Sync)' : 'Independent Mode'}
              </strong>
            </span>
            {lastTwinSyncAt && (
              <>
                <span className="text-slate-600">·</span>
                <span className="tabular-nums">
                  Last Frame:{' '}
                  {new Date(lastTwinSyncAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span>Simulated Prototype (Not Live Railway Telemetry)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEmbedActive(!embedActive)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#1C2C47] bg-[#0C1424] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500/60"
          >
            {embedActive ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                Detach 3D Canvas
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                Attach 3D Canvas
              </>
            )}
          </button>
          <button
            type="button"
            onClick={injectQuickConflict}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-red-500/45 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Inject 22416 Conflict
          </button>
          <button
            type="button"
            onClick={resetCorridor}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#1C2C47] bg-[#0C1424] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </section>

      {/* Camera & Weather Bridge Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1C2C47] bg-[#0C1424] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-sky-400" />
          <span className="font-mono text-[11px] text-slate-400">
            3D Camera Presets:
          </span>
          {[
            { id: 'overview', label: 'Corridor Overview' },
            { id: 'throat', label: 'NDLS Station Throat' },
            { id: 'follow', label: 'Follow 22416' },
          ].map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() =>
                sendTwinCommand({ type: 'CAMERA_PRESET', preset: cam.id })
              }
              className="cursor-pointer rounded border border-[#24395C] bg-[#111D33] px-2.5 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500"
            >
              {cam.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <CloudRain className="h-3.5 w-3.5 text-slate-400" />
          {(['clear', 'rain', 'thunderstorm', 'snow'] as WeatherMode[]).map(
            (w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeather(w)}
                className={`cursor-pointer rounded border px-2 py-1 font-mono text-[11px] ${
                  weather === w
                    ? 'border-sky-500/70 bg-sky-500/15 text-sky-200'
                    : 'border-[#1C2C47] bg-[#070D19] text-slate-400 hover:text-slate-200'
                }`}
              >
                {WEATHER_PROFILES[w].label}
              </button>
            )
          )}
        </div>
      </section>

      {/* Main Layout: 3D Simulator Viewport + Live Synced Telemetry Strip */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-[#1C2C47] bg-[#060B14]">
          {embedActive ? (
            <iframe
              ref={twinIframeRef}
              title="RailRaksha SIH-25022 3D Digital Twin Simulator"
              src="/simulator/RailRaksha_SIH25022_RESEARCH_V2.html"
              className="h-[560px] w-full border-0 bg-[#060B14]"
              onLoad={() => sendTwinCommand({ type: 'REQUEST_SNAPSHOT' })}
            />
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center gap-3 p-8 text-center">
              <Box className="h-10 w-10 text-sky-400" />
              <div className="font-display text-lg font-semibold text-white">
                3D Digital Twin Canvas Detached
              </div>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                The Control Centre kinematic engine, conflict queue, SHAP/LIME explainability, and AI dispatch optimization continue operating independently even when the Babylon.js simulator is closed.
              </p>
              <button
                type="button"
                onClick={() => setEmbedActive(true)}
                className="cursor-pointer rounded bg-sky-500 px-4 py-2 text-xs font-semibold text-[#040911] hover:bg-sky-400"
              >
                Re-Attach 3D Simulator
              </button>
            </div>
          )}
        </div>

        {/* Independent Corridor Telemetry Rail */}
        <aside className="rounded-lg border border-[#1C2C47] bg-[#0C1424] p-4">
          <div className="font-mono text-[11px] font-semibold text-sky-400">
            8 SIMULATED RAKES · SYNCED TELEMETRY
          </div>
          <div className="mt-3 divide-y divide-[#142038]">
            {trains.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  sendTwinCommand({ type: 'SELECT_TRAIN', trainId: t.id })
                }
                className="flex w-full cursor-pointer items-center justify-between py-2.5 text-left transition-colors hover:bg-[#111D33]/60"
              >
                <div>
                  <div className="font-mono text-xs font-semibold text-white">
                    {t.trainNo}{' '}
                    <span className="font-normal text-slate-400">
                      · {CORRIDOR_CONFIG.trackLabels[t.line].split('·')[0]}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{t.name}</div>
                </div>
                <div className="text-right font-mono text-[11px] tabular-nums">
                  <div className="text-slate-200">{t.speedKmh.toFixed(0)} km/h</div>
                  <div
                    className={
                      t.riskLevel === 'DANGER'
                        ? 'font-semibold text-red-400'
                        : t.riskLevel === 'CAUTION'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                    }
                  >
                    {t.netGapM > 900 ? 'OPEN' : `${t.netGapM.toFixed(0)}m`} ·{' '}
                    {t.riskLevel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
