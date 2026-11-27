import React, {useState} from 'react';
import {Download, Play, Trash2} from 'lucide-react';
import type {SpeedTestResult} from '../types/speedtest';
import {exportHistoryCSV, getScoreLabel} from '../utils/scoring';

interface HistoryViewProps {
  history: SpeedTestResult[];
  onClearHistory: () => void;
  onRunNewTest: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onClearHistory,
  onRunNewTest,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'precision' | 'realtime'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = history.filter((item) =>
    filterMode === 'all' ? true : item.mode === filterMode,
  );

  const avgDl =
    filtered.length > 0
      ? filtered.reduce((sum, r) => sum + r.downloadMbps, 0) / filtered.length
      : 0;
  const avgUl =
    filtered.length > 0
      ? filtered.reduce((sum, r) => sum + r.uploadMbps, 0) / filtered.length
      : 0;
  const avgPing =
    filtered.length > 0
      ? filtered.reduce((sum, r) => sum + r.pingMs, 0) / filtered.length
      : 0;
  const avgScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, r) => sum + r.veloxisScore, 0) / filtered.length,
        )
      : 0;

  if (history.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No saved speed tests yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Completed Precision Tests and saved Real-Time Monitor snapshots appear here so you can compare ISP performance across times of day.
        </p>
        <button
          type="button"
          onClick={onRunNewTest}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Play className="h-4 w-4 fill-white" aria-hidden="true" />
          <span>Run First Speed Test</span>
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Summary Averages Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Average Download</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {avgDl.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-slate-400">Mbps</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Average Upload</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {avgUl.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-slate-400">Mbps</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Average Latency</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {avgPing.toFixed(0)}
            </span>
            <span className="font-mono text-xs text-slate-400">ms</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Average Veloxis Score</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {avgScore}
            </span>
            <span className="font-mono text-xs text-slate-400">/ 100</span>
          </div>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'precision', 'realtime'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  filterMode === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'all' ? 'All Runs' : mode === 'precision' ? 'Precision' : 'Real-Time'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportHistoryCSV(filtered)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Export CSV</span>
            </button>

            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:border-rose-200 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                <th className="px-5 py-2.5 font-medium">Timestamp</th>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">ISP</th>
                <th className="px-4 py-2.5 text-right font-medium">Download</th>
                <th className="px-4 py-2.5 text-right font-medium">Upload</th>
                <th className="px-4 py-2.5 text-right font-medium">Ping</th>
                <th className="px-4 py-2.5 text-right font-medium">Jitter</th>
                <th className="px-5 py-2.5 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const scoreInfo = getScoreLabel(item.veloxisScore);
                const scoreColor =
                  scoreInfo.tone === 'emerald'
                    ? 'text-emerald-700'
                    : scoreInfo.tone === 'blue'
                      ? 'text-blue-700'
                      : scoreInfo.tone === 'amber'
                        ? 'text-amber-700'
                        : 'text-rose-700';

                return (
                  <tr
                    key={item.id}
                    className="h-10 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 capitalize whitespace-nowrap">
                      {item.mode === 'realtime' ? 'Real-Time' : 'Precision'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[180px] truncate">
                      {item.network.isp}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {item.downloadMbps.toFixed(1)} Mbps
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {item.uploadMbps.toFixed(1)} Mbps
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {item.pingMs.toFixed(0)} ms
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {item.jitterMs.toFixed(1)} ms
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${scoreColor}`}
                    >
                      {item.veloxisScore} · {scoreInfo.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
