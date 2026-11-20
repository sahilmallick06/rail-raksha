import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Clock,
  Info,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';
import { PROVENANCE_LABELS } from '../types/railraksha.ts';
import type { LiveTrainSnapshot } from '../types/railraksha.ts';

type SortKey = 'trainNo' | 'delayMinutes' | 'runningStatus' | 'cacheAgeMinutes';

function formatTs(iso: string | null): string {
  if (!iso) return 'Not available';
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Not available';
  }
}

export const TrainMonitorView: React.FC = () => {
  const {
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
  } = useControlCentre();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELAYED' | 'ON_TIME' | 'UNAVAILABLE'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('delayMinutes');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);

  // Watchlist add form
  const [newTrainNo, setNewTrainNo] = useState('');
  const [newTrainName, setNewTrainName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return watchlistTrains
      .filter((t) => {
        if (statusFilter === 'DELAYED' && t.runningStatus !== 'DELAYED') return false;
        if (statusFilter === 'ON_TIME' && t.runningStatus !== 'ON_TIME') return false;
        if (
          statusFilter === 'UNAVAILABLE' &&
          t.runningStatus !== 'STATUS_UNAVAILABLE'
        )
          return false;
        if (!q) return true;
        return (
          t.trainNo.toLowerCase().includes(q) ||
          t.trainName.toLowerCase().includes(q) ||
          t.originCode.toLowerCase().includes(q) ||
          t.destinationCode.toLowerCase().includes(q) ||
          (t.lastReportedStationName ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === 'trainNo') {
          diff = a.trainNo.localeCompare(b.trainNo);
        } else if (sortKey === 'delayMinutes') {
          diff = (a.delayMinutes ?? -1) - (b.delayMinutes ?? -1);
        } else if (sortKey === 'cacheAgeMinutes') {
          diff = a.cacheAgeMinutes - b.cacheAgeMinutes;
        } else {
          diff = a.runningStatus.localeCompare(b.runningStatus);
        }
        return sortAsc ? diff : -diff;
      });
  }, [watchlistTrains, query, statusFilter, sortKey, sortAsc]);

  const activeTrain: LiveTrainSnapshot | null = useMemo(
    () =>
      watchlistTrains.find((t) => t.trainNo === selectedMonitorTrainNo) ?? null,
    [watchlistTrains, selectedMonitorTrainNo]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const toggleBatchTrain = (trainNo: string) => {
    setSelectedForBatch((prev) => {
      if (prev.includes(trainNo)) return prev.filter((id) => id !== trainNo);
      if (prev.length >= (quota?.maxFleetRefreshTrains ?? 3)) return prev;
      return [...prev, trainNo];
    });
  };

  const handleAddTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = await addWatchlistTrain(newTrainNo, newTrainName);
    if (err) setFormError(err);
    else {
      setNewTrainNo('');
      setNewTrainName('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Quota Bar */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#1C2C47] pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="font-mono text-xs text-sky-400">
            TRAIN MONITOR · THIRD_PARTY_REPORTED / CACHED WATCHLIST
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
            Live & Cached Train Movement Table
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            External station-level running status is strictly manual-refresh and quota-protected (max 12 calls/day, 240/month, 30-min fresh cache, 7-day stale fallback). No background polling ever occurs.
          </p>
        </div>

        {/* Quota Readout */}
        <div className="rounded border border-[#1C2C47] bg-[#0C1424] px-4 py-2.5 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 tabular-nums">
            <span>
              RailRadar Key:{' '}
              <strong
                className={
                  quota?.railradarKeyConfigured
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }
              >
                {quota?.railradarKeyConfigured ? 'CONFIGURED' : 'CACHED MODE'}
              </strong>
            </span>
            <span className="text-slate-600">·</span>
            <span>
              Daily: {quota?.dailyUsed ?? 0}/{quota?.dailyLimit ?? 12}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              Monthly: {quota?.monthlyUsed ?? 0}/{quota?.monthlyLimit ?? 240}
            </span>
            <span className="text-slate-600">·</span>
            <span>Cache Hits: {quota?.totalCacheHits ?? 0}</span>
          </div>
          {quota?.cooldownActive && (
            <div className="mt-1 text-[11px] text-red-400">
              HTTP 429 cooldown active until {formatTs(quota.cooldownUntil)}
            </div>
          )}
        </div>
      </section>

      {monitorNotice && (
        <div className="flex items-center justify-between gap-3 rounded border border-sky-500/35 bg-[#0C182C] px-4 py-2.5 font-mono text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-sky-400" />
            <span>{monitorNotice}</span>
          </div>
        </div>
      )}

      {/* Search, Filter, Add-to-Watchlist & Batch Refresh Controls */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search train no, name, origin, destination, station..."
              className="w-full rounded border border-[#1C2C47] bg-[#0C1424] py-2 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded border border-[#1C2C47] bg-[#0C1424] p-1 font-mono text-[11px]">
            {(['ALL', 'DELAYED', 'ON_TIME', 'UNAVAILABLE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`cursor-pointer rounded px-2.5 py-1 transition-colors ${
                  statusFilter === st
                    ? 'bg-[#162542] text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={selectedForBatch.length === 0 || refreshingFleet}
            onClick={() => refreshSelectedFleet(selectedForBatch)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshingFleet ? 'animate-spin' : ''}`}
            />
            Manual Refresh Selected ({selectedForBatch.length}/
            {quota?.maxFleetRefreshTrains ?? 3})
          </button>
        </div>

        {/* Add any Indian Railways train number to watchlist */}
        <form
          onSubmit={handleAddTrain}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={newTrainNo}
            onChange={(e) => setNewTrainNo(e.target.value)}
            placeholder="Train No (e.g. 12301)"
            className="w-36 rounded border border-[#1C2C47] bg-[#0C1424] px-2.5 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <input
            type="text"
            value={newTrainName}
            onChange={(e) => setNewTrainName(e.target.value)}
            placeholder="Optional Train Name"
            className="w-44 rounded border border-[#1C2C47] bg-[#0C1424] px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-1 rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-[#040911] hover:bg-sky-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Watchlist
          </button>
        </form>
      </section>

      {formError && (
        <div className="font-mono text-xs text-red-400">{formError}</div>
      )}

      {/* Main Movement Table */}
      <section className="overflow-hidden rounded-lg border border-[#1C2C47] bg-[#0C1424]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#1C2C47] bg-[#080F1D] font-mono text-[11px] text-slate-400">
                <th className="w-10 px-3 py-3 text-center">Sel</th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('trainNo')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-white"
                  >
                    Train <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-3">Origin → Dest</th>
                <th className="px-3 py-3">Last Reported Station</th>
                <th className="px-3 py-3">Next Scheduled Station</th>
                <th className="px-3 py-3">Sched / Reported ETA</th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('delayMinutes')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-white"
                  >
                    Delay <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('runningStatus')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-white"
                  >
                    Status <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-3">Source & Updated</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142038]">
              {filtered.map((t) => {
                const checked = selectedForBatch.includes(t.trainNo);
                const isSelected = selectedMonitorTrainNo === t.trainNo;
                return (
                  <tr
                    key={t.trainNo}
                    onClick={() => setSelectedMonitorTrainNo(t.trainNo)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#12203A]' : 'hover:bg-[#0F1A2E]'
                    }`}
                  >
                    <td
                      className="px-3 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBatchTrain(t.trainNo)}
                        aria-label={`Select train ${t.trainNo} for manual refresh`}
                        className="h-3.5 w-3.5 cursor-pointer accent-sky-400"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono font-semibold text-white">
                        {t.trainNo}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.trainName}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-300">
                      {t.originCode} → {t.destinationCode}
                    </td>
                    <td className="px-3 py-3">
                      {t.lastReportedStationCode ? (
                        <div>
                          <span className="font-mono font-medium text-slate-200">
                            {t.lastReportedStationCode}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-400">
                            {t.lastReportedStationName}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-500">
                          Not available
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {t.nextScheduledStationCode ? (
                        <div>
                          <span className="font-mono font-medium text-slate-200">
                            {t.nextScheduledStationCode}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-400">
                            {t.nextScheduledStationName}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-500">
                          Not available
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-slate-300">
                      {t.scheduledEta ?? 'N/A'} /{' '}
                      <span className="text-sky-300">
                        {t.reportedEta ?? 'Not available'}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums">
                      {t.delayMinutes === null ? (
                        <span className="text-slate-500">Not available</span>
                      ) : t.delayMinutes >= 10 ? (
                        <span className="font-semibold text-amber-300">
                          +{t.delayMinutes} min
                        </span>
                      ) : t.delayMinutes > 0 ? (
                        <span className="text-slate-200">+{t.delayMinutes} min</span>
                      ) : (
                        <span className="text-emerald-400">On time (0m)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px]">
                      <span
                        className={
                          t.runningStatus === 'DELAYED'
                            ? 'text-amber-300'
                            : t.runningStatus === 'ON_TIME'
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                        }
                      >
                        {t.runningStatus.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px]">
                      <div
                        className={
                          t.provenance === 'THIRD_PARTY_REPORTED'
                            ? 'text-sky-300'
                            : 'text-slate-300'
                        }
                      >
                        {PROVENANCE_LABELS[t.provenance]}
                        {t.isStale ? ' · STALE' : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {formatTs(t.lastUpdatedAt)} ({t.cacheAgeMinutes}m age)
                      </div>
                    </td>
                    <td
                      className="px-3 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => refreshSingleTrain(t.trainNo)}
                          disabled={refreshingTrainNo === t.trainNo}
                          className="cursor-pointer rounded border border-[#24395C] bg-[#111D33] px-2 py-1 font-mono text-[11px] text-sky-300 hover:border-sky-500"
                          title="Manual quota-protected refresh"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              refreshingTrainNo === t.trainNo ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWatchlistTrain(t.trainNo)}
                          className="cursor-pointer rounded border border-[#24395C] bg-[#111D33] px-2 py-1 text-slate-400 hover:border-red-500/50 hover:text-red-300"
                          title="Remove from watchlist"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center font-mono text-xs text-slate-500"
                  >
                    No watchlist trains match your search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Train Detail Slide-Over Drawer */}
      {activeTrain && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => setSelectedMonitorTrainNo(null)}
        >
          <aside
            className="flex h-full w-full max-w-lg flex-col border-l border-[#1C2C47] bg-[#080F1D]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#1C2C47] px-5 py-4">
              <div>
                <div className="font-mono text-[11px] text-sky-400">
                  {activeTrain.provenance} · TRAIN DETAIL INSPECTOR
                </div>
                <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                  {activeTrain.trainNo} · {activeTrain.trainName}
                </h2>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {activeTrain.originCode} ({activeTrain.originName}) →{' '}
                  {activeTrain.destinationCode} ({activeTrain.destinationName})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMonitorTrainNo(null)}
                className="cursor-pointer rounded border border-[#1C2C47] p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-[#1C2C47] bg-[#0C1424] p-3">
                  <div className="font-mono text-[10px] text-slate-400">
                    REPORTED DELAY
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-300">
                    {activeTrain.delayMinutes !== null
                      ? `+${activeTrain.delayMinutes} min`
                      : 'Not available'}
                  </div>
                </div>
                <div className="rounded border border-[#1C2C47] bg-[#0C1424] p-3">
                  <div className="font-mono text-[10px] text-slate-400">
                    FRESHNESS / SOURCE
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-sky-300">
                    {activeTrain.cacheAgeMinutes}m old ·{' '}
                    {activeTrain.isStale ? 'Stale Cache' : 'Fresh Cache'}
                  </div>
                </div>
              </div>

              {/* Explicit Transparency for Non-API Fields */}
              <div className="rounded border border-[#1C2C47] bg-[#0C1424] p-3.5">
                <div className="font-mono text-[11px] font-semibold text-slate-300">
                  Data Availability & Boundary Notice
                </div>
                <p className="mt-1 leading-relaxed text-slate-400">
                  {activeTrain.unavailableFieldsNote}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 font-mono text-[11px] text-slate-400">
                  <span>Live Track-Circuit GPS:</span>
                  <span className="text-slate-500">Not available</span>
                  <span>Physical Signal Aspect:</span>
                  <span className="text-slate-500">Not available</span>
                  <span>Live Inter-Train Gap (m):</span>
                  <span className="text-slate-500">Not available</span>
                </div>
              </div>

              {/* Station Timeline */}
              <div>
                <h3 className="font-mono text-[11px] font-semibold text-sky-400">
                  STATION TIMELINE
                </h3>
                {activeTrain.stationTimeline.length > 0 ? (
                  <div className="mt-2.5 divide-y divide-[#142038] rounded border border-[#1C2C47] bg-[#0C1424]">
                    {activeTrain.stationTimeline.map((st) => (
                      <div
                        key={st.stationCode}
                        className="flex items-center justify-between px-3.5 py-2.5"
                      >
                        <div>
                          <div className="font-mono font-semibold text-slate-100">
                            {st.stationCode}{' '}
                            <span className="font-sans font-normal text-slate-400">
                              {st.stationName}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {st.distanceKm !== null ? `${st.distanceKm} km` : 'Distance N/A'} ·{' '}
                            {st.status}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-slate-200">
                            {st.scheduledArrival ?? st.scheduledDeparture ?? 'N/A'}
                          </div>
                          <div className="text-[10px] text-amber-300">
                            {st.delayMin !== null ? `+${st.delayMin}m` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded border border-[#1C2C47] bg-[#0C1424] p-3 font-mono text-slate-500">
                    Station timeline not available until an external snapshot is fetched.
                  </div>
                )}
              </div>

              {/* Historical Observations */}
              <div>
                <h3 className="font-mono text-[11px] font-semibold text-sky-400">
                  OBSERVATION HISTORY
                </h3>
                <div className="mt-2 space-y-2">
                  {activeTrain.historicalObservations.length > 0 ? (
                    activeTrain.historicalObservations.map((obs, idx) => (
                      <div
                        key={`${obs.observedAt}-${idx}`}
                        className="rounded border border-[#142038] bg-[#0C1424] p-3 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between text-slate-300">
                          <span>
                            {obs.stationCode} · {obs.source}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3" />
                            {formatTs(obs.observedAt)}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-400">{obs.note}</div>
                      </div>
                    ))
                  ) : (
                    <div className="font-mono text-slate-500">
                      No historical observations recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#1C2C47] px-5 py-3">
              <span className="font-mono text-[11px] text-slate-400">
                Source: {activeTrain.sourceLabel}
              </span>
              <button
                type="button"
                onClick={() => refreshSingleTrain(activeTrain.trainNo)}
                disabled={refreshingTrainNo === activeTrain.trainNo}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-[#040911] hover:bg-sky-400"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    refreshingTrainNo === activeTrain.trainNo ? 'animate-spin' : ''
                  }`}
                />
                Manual Refresh
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
