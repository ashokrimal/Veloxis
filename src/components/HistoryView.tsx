import React, {useEffect, useState} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  Download,
  Play,
  Trash2,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {SpeedTestResult, SpeedUnit} from '../types/speedtest';
import {
  evaluateBufferbloat,
  exportHistoryCSV,
  formatDuration,
  formatSpeedValue,
  formatTransferSize,
  getScoreLabel,
} from '../utils/scoring';
import {HistoryComparison} from './HistoryComparison';

interface HistoryViewProps {
  history: SpeedTestResult[];
  speedUnit: SpeedUnit;
  isDark?: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onClearHistory: () => void;
  onRunNewTest: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  speedUnit,
  isDark = false,
  isExpanded,
  onToggleExpanded,
  onClearHistory,
  onRunNewTest,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'precision' | 'file' | 'realtime'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [runAId, setRunAId] = useState<string>(() => history[1]?.id ?? history[0]?.id ?? '');
  const [runBId, setRunBId] = useState<string>(() => history[0]?.id ?? '');

  // Keep selected comparison IDs valid as new tests are added or history is cleared
  useEffect(() => {
    if (history.length < 2) {
      setIsComparing(false);
    }
    if (history.length > 0) {
      const hasA = history.some((item) => item.id === runAId);
      const hasB = history.some((item) => item.id === runBId);
      if (!hasA) {
        setRunAId(history[1]?.id ?? history[0].id);
      }
      if (!hasB) {
        setRunBId(history[0].id);
      }
    }
  }, [history, runAId, runBId]);

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

  const canCompare = history.length >= 2;

  const handleAssignCompareSlot = (id: string, slot: 'A' | 'B') => {
    if (slot === 'A') {
      setRunAId(id);
    } else {
      setRunBId(id);
    }
    if (!isComparing) {
      setIsComparing(true);
    }
  };

  return (
    <section
      id="history"
      aria-label="Speed test history"
      className="overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] vx-card transition-colors duration-200"
    >
      {/* Card Header with History Toggle Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-slate-50">
            Test History
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
            {history.length === 0
              ? 'Completed tests and monitor snapshots will be saved locally here.'
              : `${history.length} saved ${history.length === 1 ? 'run' : 'runs'} · Avg ${formatSpeedValue(avgDl, speedUnit)} ${speedUnit} down · ${avgPing.toFixed(0)} ms ping`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCompare && (
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) onToggleExpanded();
                setIsComparing((prev) => (isExpanded ? !prev : true));
              }}
              aria-pressed={isExpanded && isComparing}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isExpanded && isComparing
                  ? 'vx-pill-active text-[#1D4ED8] dark:text-[#38BDF8]'
                  : 'bg-white dark:bg-[#131C31] text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] vx-btn-secondary'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Compare Runs</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#131C31] px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] vx-btn-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{isExpanded ? 'Hide History' : `View History (${history.length})`}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="history-body"
            initial={{opacity: 0, y: -6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -6}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
            className="border-t border-[#EAE6DD] dark:border-[#1E2942]"
          >
          {history.length === 0 ? (
            <div className="px-6 py-10 text-center sm:px-8">
              <p className="mx-auto max-w-md text-sm text-stone-500 dark:text-slate-400">
                No saved speed tests yet. Run a Quick Test, Subscription File Test, or save a Live Monitor snapshot to log results here.
              </p>
              <button
                type="button"
                onClick={onRunNewTest}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#0EA5E9] px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-950 hover:bg-[#1E40AF] dark:hover:bg-[#38BDF8] transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Run Speed Test</span>
              </button>
            </div>
          ) : (
            <>
              {/* Summary Averages Band */}
              <div className="grid grid-cols-2 gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-6 py-5 sm:grid-cols-4 sm:px-8">
                <div>
                  <div className="text-xs text-stone-500 dark:text-slate-400">Average Download</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                      {formatSpeedValue(avgDl, speedUnit)}
                    </span>
                    <span className="font-mono text-xs text-stone-400 dark:text-slate-500">{speedUnit}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-slate-400">Average Upload</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                      {formatSpeedValue(avgUl, speedUnit)}
                    </span>
                    <span className="font-mono text-xs text-stone-400 dark:text-slate-500">{speedUnit}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-slate-400">Average Latency</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                      {avgPing.toFixed(0)}
                    </span>
                    <span className="font-mono text-xs text-stone-400 dark:text-slate-500">ms</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-slate-400">Average Score</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                      {avgScore}
                    </span>
                    <span className="font-mono text-xs text-stone-400 dark:text-slate-500">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Panel */}
              <AnimatePresence>
                {isComparing && canCompare && (
                  <HistoryComparison
                    history={history}
                    runAId={runAId}
                    runBId={runBId}
                    speedUnit={speedUnit}
                    isDark={isDark}
                    onChangeRunA={setRunAId}
                    onChangeRunB={setRunBId}
                    onSwapRuns={() => {
                      setRunAId(runBId);
                      setRunBId(runAId);
                    }}
                    onClose={() => setIsComparing(false)}
                  />
                )}
              </AnimatePresence>

              {/* Filter & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] px-6 py-3.5 sm:px-8">
                <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-[#EAE6DD]/75 dark:bg-[#131C31]/75 p-0.5 vx-pill-tray">
                  {(['all', 'precision', 'file', 'realtime'] as const).map((mode) => {
                    const active = filterMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFilterMode(mode)}
                        className={`relative rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? 'text-stone-900 dark:text-slate-50 font-semibold'
                            : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="history-filter-pill"
                            transition={{type: 'spring', stiffness: 460, damping: 34}}
                            className="absolute inset-0 rounded-md vx-pill-active"
                          />
                        )}
                        <span className="relative z-10">
                          {mode === 'all'
                            ? 'All Runs'
                            : mode === 'precision'
                              ? 'Quick'
                              : mode === 'file'
                                ? 'File Transfer'
                                : 'Live Monitor'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canCompare ? (
                    <button
                      type="button"
                      onClick={() => setIsComparing((prev) => !prev)}
                      aria-pressed={isComparing}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
                        isComparing
                          ? 'border-[#1D4ED8] dark:border-[#0EA5E9] bg-[#1D4ED8]/10 dark:bg-[#0EA5E9]/15 text-[#1D4ED8] dark:text-[#38BDF8]'
                          : 'border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540]'
                      }`}
                    >
                      <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isComparing ? 'Comparing 2 Runs' : 'Compare 2 Runs'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-stone-400 dark:text-slate-500">
                      Run 2 tests to compare
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => exportHistoryCSV(filtered)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] cursor-pointer whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
                    <span>Export CSV</span>
                  </button>

                  {confirmClear ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClearHistory();
                          setConfirmClear(false);
                          setIsComparing(false);
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
                      >
                        Confirm Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-[#F8F7F4] dark:hover:bg-[#131C31] cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 cursor-pointer whitespace-nowrap"
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
                    <tr className="border-b border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] text-stone-500 dark:text-slate-400">
                      {canCompare && (
                        <th className="pl-6 pr-2 py-2.5 font-medium sm:pl-8">
                          Compare
                        </th>
                      )}
                      <th className={`${canCompare ? 'px-4' : 'px-6 sm:px-8'} py-2.5 font-medium`}>
                        Timestamp
                      </th>
                      <th className="px-4 py-2.5 font-medium">Mode</th>
                      <th className="px-4 py-2.5 font-medium">ISP</th>
                      <th className="px-4 py-2.5 text-right font-medium">Download</th>
                      <th className="px-4 py-2.5 text-right font-medium">Upload</th>
                      <th className="px-4 py-2.5 text-right font-medium">Ping</th>
                      <th className="px-4 py-2.5 text-right font-medium">Bloat</th>
                      <th className="px-4 py-2.5 text-right font-medium">Jitter</th>
                      <th className="px-4 py-2.5 text-right font-medium">Time Taken</th>
                      <th className="px-6 py-2.5 text-right font-medium sm:px-8">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DD] dark:divide-[#1E2942]">
                    {filtered.map((item) => {
                      const scoreInfo = getScoreLabel(item.veloxisScore);
                      const scoreColor =
                        scoreInfo.tone === 'emerald'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : scoreInfo.tone === 'blue'
                            ? 'text-[#1D4ED8] dark:text-[#38BDF8]'
                            : scoreInfo.tone === 'amber'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400';

                      const modeLabel =
                        item.mode === 'realtime'
                          ? 'Live Monitor'
                          : item.mode === 'file' && item.transferredBytes
                            ? `File (${formatTransferSize(item.transferredBytes.download)})`
                            : 'Quick Test';

                      const isA = isComparing && item.id === runAId;
                      const isB = isComparing && item.id === runBId;

                      return (
                        <tr
                          key={item.id}
                          className={`h-10 transition-colors ${
                            isA || isB
                              ? 'bg-[#1D4ED8]/6 dark:bg-[#0EA5E9]/10'
                              : 'hover:bg-[#F8F7F4] dark:hover:bg-[#131C31]/50'
                          }`}
                        >
                          {canCompare && (
                            <td className="pl-6 pr-2 py-2 sm:pl-8 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAssignCompareSlot(item.id, 'A')}
                                  aria-pressed={isA}
                                  title="Select as Run A (Baseline)"
                                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                                    isA
                                      ? 'bg-stone-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                      : 'border border-[#DFDAD0] dark:border-[#1E2942] text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                                  }`}
                                >
                                  A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAssignCompareSlot(item.id, 'B')}
                                  aria-pressed={isB}
                                  title="Select as Run B (Compared)"
                                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                                    isB
                                      ? 'bg-[#1D4ED8] dark:bg-[#0EA5E9] text-white dark:text-slate-950'
                                      : 'border border-[#DFDAD0] dark:border-[#1E2942] text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                                  }`}
                                >
                                  B
                                </button>
                              </div>
                            </td>
                          )}
                          <td
                            className={`${canCompare ? 'px-4' : 'px-6 sm:px-8'} py-2.5 font-mono text-stone-600 dark:text-slate-400 tabular-nums whitespace-nowrap`}
                          >
                            {new Date(item.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-stone-700 dark:text-slate-300 whitespace-nowrap">
                            {modeLabel}
                          </td>
                          <td className="px-4 py-2.5 text-stone-600 dark:text-slate-300 max-w-[160px] truncate">
                            {item.network.isp || 'Unavailable'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                            {formatSpeedValue(item.downloadMbps, speedUnit)} {speedUnit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                            {formatSpeedValue(item.uploadMbps, speedUnit)} {speedUnit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-stone-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {item.pingMs.toFixed(0)} ms
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-stone-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {item.bufferbloatGrade ??
                              evaluateBufferbloat(item.pingMs, item.loadedPingMs).grade}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-stone-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {item.jitterMs.toFixed(1)} ms
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-stone-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                            {item.durationSec !== undefined
                              ? formatDuration(item.durationSec)
                              : '--'}
                          </td>
                          <td
                            className={`px-6 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap sm:px-8 ${scoreColor}`}
                          >
                            {item.veloxisScore} · {scoreInfo.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
