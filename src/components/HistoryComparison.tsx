import React from 'react';
import {ArrowDownRight, ArrowLeftRight, ArrowUpRight, Minus, X} from 'lucide-react';
import {motion} from 'motion/react';
import type {SpeedTestResult, SpeedUnit} from '../types/speedtest';
import {
  convertSpeed,
  formatSpeedValue,
  formatTransferSize,
  getScoreLabel,
} from '../utils/scoring';

interface HistoryComparisonProps {
  history: SpeedTestResult[];
  runAId: string;
  runBId: string;
  speedUnit: SpeedUnit;
  onChangeRunA: (id: string) => void;
  onChangeRunB: (id: string) => void;
  onSwapRuns: () => void;
  onClose: () => void;
}

interface MetricComparisonRow {
  key: string;
  label: string;
  valA: number;
  valB: number;
  displayA: string;
  displayB: string;
  unit: string;
  higherIsBetter: boolean;
  decimals: number;
  convertDelta?: (delta: number) => number;
}

function formatRunOptionLabel(item: SpeedTestResult, unit: SpeedUnit): string {
  const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const modeStr =
    item.mode === 'realtime'
      ? 'Live'
      : item.mode === 'file'
        ? 'File'
        : 'Quick';
  return `${dateStr} · ${modeStr} · ${formatSpeedValue(item.downloadMbps, unit)} ${unit}`;
}

function formatModeName(item: SpeedTestResult): string {
  if (item.mode === 'realtime') return 'Live Monitor';
  if (item.mode === 'file' && item.transferredBytes) {
    return `File (${formatTransferSize(item.transferredBytes.download)})`;
  }
  return item.mode === 'file' ? 'File Transfer' : 'Quick Test';
}

export const HistoryComparison: React.FC<HistoryComparisonProps> = ({
  history,
  runAId,
  runBId,
  speedUnit,
  onChangeRunA,
  onChangeRunB,
  onSwapRuns,
  onClose,
}) => {
  const runA = history.find((r) => r.id === runAId) ?? history[1] ?? history[0];
  const runB = history.find((r) => r.id === runBId) ?? history[0];

  if (!runA || !runB) return null;

  const speedDecimals = speedUnit === 'MBps' ? 2 : 1;

  const metrics: MetricComparisonRow[] = [
    {
      key: 'download',
      label: 'Download Speed',
      valA: convertSpeed(runA.downloadMbps, speedUnit),
      valB: convertSpeed(runB.downloadMbps, speedUnit),
      displayA: formatSpeedValue(runA.downloadMbps, speedUnit),
      displayB: formatSpeedValue(runB.downloadMbps, speedUnit),
      unit: speedUnit,
      higherIsBetter: true,
      decimals: speedDecimals,
    },
    {
      key: 'upload',
      label: 'Upload Speed',
      valA: convertSpeed(runA.uploadMbps, speedUnit),
      valB: convertSpeed(runB.uploadMbps, speedUnit),
      displayA: formatSpeedValue(runA.uploadMbps, speedUnit),
      displayB: formatSpeedValue(runB.uploadMbps, speedUnit),
      unit: speedUnit,
      higherIsBetter: true,
      decimals: speedDecimals,
    },
    {
      key: 'ping',
      label: 'Unloaded Ping',
      valA: runA.pingMs,
      valB: runB.pingMs,
      displayA: runA.pingMs.toFixed(0),
      displayB: runB.pingMs.toFixed(0),
      unit: 'ms',
      higherIsBetter: false,
      decimals: 0,
    },
    {
      key: 'loadedPing',
      label: 'Loaded Ping',
      valA: runA.loadedPingMs,
      valB: runB.loadedPingMs,
      displayA: runA.loadedPingMs.toFixed(0),
      displayB: runB.loadedPingMs.toFixed(0),
      unit: 'ms',
      higherIsBetter: false,
      decimals: 0,
    },
    {
      key: 'jitter',
      label: 'Jitter',
      valA: runA.jitterMs,
      valB: runB.jitterMs,
      displayA: runA.jitterMs.toFixed(1),
      displayB: runB.jitterMs.toFixed(1),
      unit: 'ms',
      higherIsBetter: false,
      decimals: 1,
    },
    {
      key: 'loss',
      label: 'Packet Loss',
      valA: runA.packetLossPct,
      valB: runB.packetLossPct,
      displayA: runA.packetLossPct.toFixed(1),
      displayB: runB.packetLossPct.toFixed(1),
      unit: '%',
      higherIsBetter: false,
      decimals: 1,
    },
    {
      key: 'score',
      label: 'Veloxis Score',
      valA: runA.veloxisScore,
      valB: runB.veloxisScore,
      displayA: String(runA.veloxisScore),
      displayB: String(runB.veloxisScore),
      unit: '/ 100',
      higherIsBetter: true,
      decimals: 0,
    },
  ];

  // Overall headline summary between A -> B
  const dlDiff = metrics[0].valB - metrics[0].valA;
  const dlPct =
    metrics[0].valA > 0 ? Math.round((dlDiff / metrics[0].valA) * 100) : 0;
  const pingDiff = runB.pingMs - runA.pingMs;
  const scoreDiff = runB.veloxisScore - runA.veloxisScore;

  const sameEntry = runA.id === runB.id;
  const maxDl = Math.max(metrics[0].valA, metrics[0].valB, 0.01);
  const maxUl = Math.max(metrics[1].valA, metrics[1].valB, 0.01);

  const scoreInfoA = getScoreLabel(runA.veloxisScore);
  const scoreInfoB = getScoreLabel(runB.veloxisScore);

  return (
    <motion.div
      initial={{opacity: 0, y: -6}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: -6}}
      transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
      aria-label="Side-by-side test comparison"
      className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/55"
    >
      {/* Comparison Header & Run Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 sm:px-8">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Side-by-Side Comparison
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Select two saved runs below or from the table to measure improvements or degradation from Run A to Run B.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSwapRuns}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <span>Swap A / B</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison view"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Dropdown Picker Row */}
      <div className="grid grid-cols-1 gap-4 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 sm:grid-cols-2 sm:px-8">
        <div>
          <label
            htmlFor="compare-run-a"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Run A (Baseline)
          </label>
          <select
            id="compare-run-a"
            value={runA.id}
            onChange={(e) => onChangeRunA(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
          >
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {formatRunOptionLabel(item, speedUnit)}
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{formatModeName(runA)}</span>
            <span aria-hidden="true">·</span>
            <span>{runA.network.isp || 'Unknown ISP'}</span>
            <span aria-hidden="true">·</span>
            <span>{scoreInfoA.label}</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="compare-run-b"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Run B (Compared)
          </label>
          <select
            id="compare-run-b"
            value={runB.id}
            onChange={(e) => onChangeRunB(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
          >
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {formatRunOptionLabel(item, speedUnit)}
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{formatModeName(runB)}</span>
            <span aria-hidden="true">·</span>
            <span>{runB.network.isp || 'Unknown ISP'}</span>
            <span aria-hidden="true">·</span>
            <span>{scoreInfoB.label}</span>
          </div>
        </div>
      </div>

      {/* Net Summary Note */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827]/70 px-6 py-3.5 text-xs sm:px-8">
        {sameEntry ? (
          <span className="text-amber-700 dark:text-amber-400 font-medium">
            Run A and Run B are set to the same entry. Select two different entries to inspect performance changes.
          </span>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
            <span>
              From Run A to Run B:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Download {dlDiff >= 0 ? `+${dlDiff.toFixed(speedDecimals)}` : dlDiff.toFixed(speedDecimals)} {speedUnit} ({dlPct >= 0 ? `+${dlPct}%` : `${dlPct}%`})
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Ping {pingDiff >= 0 ? `+${pingDiff.toFixed(0)}` : pingDiff.toFixed(0)} ms
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Score {scoreDiff >= 0 ? `+${scoreDiff}` : scoreDiff} pts
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Side-by-Side Throughput Visual Bars */}
      <div className="grid grid-cols-1 gap-6 border-b border-slate-200/80 dark:border-slate-800 px-6 py-5 sm:grid-cols-2 sm:px-8">
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Download Comparison ({speedUnit})
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Run A</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {metrics[0].displayA} {speedUnit}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  className="h-full bg-slate-500 dark:bg-slate-400 origin-left"
                  initial={{scaleX: 0}}
                  animate={{scaleX: Math.max(0.02, metrics[0].valA / maxDl)}}
                  transition={{type: 'spring', stiffness: 140, damping: 22}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Run B</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
                  {metrics[0].displayB} {speedUnit}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  className="h-full bg-blue-600 dark:bg-blue-500 origin-left"
                  initial={{scaleX: 0}}
                  animate={{scaleX: Math.max(0.02, metrics[0].valB / maxDl)}}
                  transition={{type: 'spring', stiffness: 140, damping: 22, delay: 0.05}}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Upload Comparison ({speedUnit})
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Run A</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {metrics[1].displayA} {speedUnit}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  className="h-full bg-slate-500 dark:bg-slate-400 origin-left"
                  initial={{scaleX: 0}}
                  animate={{scaleX: Math.max(0.02, metrics[1].valA / maxUl)}}
                  transition={{type: 'spring', stiffness: 140, damping: 22}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Run B</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
                  {metrics[1].displayB} {speedUnit}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  className="h-full bg-cyan-600 dark:bg-cyan-400 origin-left"
                  initial={{scaleX: 0}}
                  animate={{scaleX: Math.max(0.02, metrics[1].valB / maxUl)}}
                  transition={{type: 'spring', stiffness: 140, damping: 22, delay: 0.05}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Side-by-Side Metric Delta Table */}
      <div className="overflow-x-auto bg-white dark:bg-[#111827]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
              <th className="px-6 py-2.5 font-medium sm:px-8">Metric</th>
              <th className="px-4 py-2.5 text-right font-medium">Run A (Baseline)</th>
              <th className="px-4 py-2.5 text-right font-medium">Run B (Compared)</th>
              <th className="px-4 py-2.5 text-right font-medium">Change</th>
              <th className="px-6 py-2.5 text-right font-medium sm:px-8">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {metrics.map((row) => {
              const delta = row.valB - row.valA;
              const epsilon = row.decimals === 0 ? 0.5 : 0.05;
              const isUnchanged = Math.abs(delta) < epsilon;
              const improved = !isUnchanged && (row.higherIsBetter ? delta > 0 : delta < 0);

              const pctChange =
                row.valA > 0
                  ? Math.round((delta / row.valA) * 100)
                  : null;

              const signedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(row.decimals)} ${row.unit}`;
              const pctText =
                pctChange !== null && !isUnchanged
                  ? ` (${pctChange > 0 ? `+${pctChange}` : pctChange}%)`
                  : '';

              const statusColor = isUnchanged
                ? 'text-slate-500 dark:text-slate-400'
                : improved
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400';

              return (
                <tr key={row.key} className="h-11">
                  <td className="px-6 py-2.5 font-medium text-slate-800 dark:text-slate-200 sm:px-8">
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {row.displayA} {row.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    {row.displayB} {row.unit}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${statusColor}`}
                  >
                    {isUnchanged ? '0' : `${signedDelta}${pctText}`}
                  </td>
                  <td className={`px-6 py-2.5 text-right font-medium whitespace-nowrap sm:px-8 ${statusColor}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      {isUnchanged ? (
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : improved ? (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {isUnchanged ? 'Unchanged' : improved ? 'Improved' : 'Degraded'}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
