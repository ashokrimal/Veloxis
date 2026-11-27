import React, {useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import type {SpeedTestResult, SpeedUnit} from '../types/speedtest';
import {convertSpeed, formatSpeedValue} from '../utils/scoring';

interface HistoryTrendsChartProps {
  history: SpeedTestResult[];
  speedUnit: SpeedUnit;
  isDark?: boolean;
}

type TrendMetric = 'speed' | 'latency' | 'score';

export const HistoryTrendsChart: React.FC<HistoryTrendsChartProps> = ({
  history,
  speedUnit,
  isDark = false,
}) => {
  const [metric, setMetric] = useState<TrendMetric>('speed');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Chronological order: oldest left -> newest right (up to latest 25 runs for clean readability)
  const chronological = useMemo(
    () => [...history].slice(0, 25).reverse(),
    [history],
  );

  const primaryColor =
    metric === 'latency'
      ? isDark
        ? '#FBBF24'
        : '#D97706'
      : metric === 'score'
        ? isDark
          ? '#34D399'
          : '#059669'
        : isDark
          ? '#60A5FA'
          : '#2563EB';

  const secondaryColor =
    metric === 'latency'
      ? isDark
        ? '#F87171'
        : '#DC2626'
      : isDark
        ? '#22D3EE'
        : '#0891B2';

  const gridStroke = isDark ? '#1E293B' : '#E2E8F0';
  const crosshairStroke = isDark ? '#64748B' : '#94A3B8';
  const dotStroke = isDark ? '#111827' : '#FFFFFF';

  const width = 680;
  const height = 216;
  const pad = {top: 20, right: 18, bottom: 28, left: 46};
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const series = useMemo(() => {
    return chronological.map((item) => {
      if (metric === 'latency') {
        return {
          item,
          primary: item.pingMs,
          secondary: item.loadedPingMs,
        };
      }
      if (metric === 'score') {
        return {
          item,
          primary: item.veloxisScore,
          secondary: null,
        };
      }
      return {
        item,
        primary: convertSpeed(item.downloadMbps, speedUnit),
        secondary: convertSpeed(item.uploadMbps, speedUnit),
      };
    });
  }, [chronological, metric, speedUnit]);

  const yMax = useMemo(() => {
    if (metric === 'score') return 100;
    const step = metric === 'latency' ? 25 : speedUnit === 'MBps' ? 5 : 25;
    const maxVal = Math.max(
      step,
      ...series.map((s) => s.primary),
      ...series.map((s) => s.secondary ?? 0),
    );
    return Math.ceil(maxVal / step) * step;
  }, [metric, series, speedUnit]);

  const xForIdx = (idx: number) => {
    if (series.length <= 1) return pad.left + plotW / 2;
    return pad.left + (idx / (series.length - 1)) * plotW;
  };

  const yForVal = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / Math.max(1, yMax)));
    return pad.top + plotH - ratio * plotH;
  };

  const primaryPath = series
    .map(
      (pt, i) =>
        `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForVal(pt.primary).toFixed(1)}`,
    )
    .join(' ');

  const primaryAreaPath =
    series.length >= 2
      ? `${primaryPath} L ${xForIdx(series.length - 1).toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${xForIdx(0).toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
      : '';

  const secondaryPath =
    metric === 'score'
      ? ''
      : series
          .map(
            (pt, i) =>
              `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForVal(pt.secondary ?? 0).toFixed(1)}`,
          )
          .join(' ');

  const yTicks = [0, yMax * 0.5, yMax];
  const activePt = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;

  // Compute overall chronological trend summary
  const firstPt = series[0];
  const lastPt = series[series.length - 1];
  const netDelta = firstPt && lastPt ? lastPt.primary - firstPt.primary : 0;

  return (
    <motion.section
      id="trends"
      initial={{opacity: 0, y: 10}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
      aria-label="Historical network performance trends"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 transition-colors duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Performance Trends
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {chronological.length >= 2
              ? `Tracking ${chronological.length} chronological runs · Net ${
                  metric === 'speed'
                    ? `download ${netDelta >= 0 ? `+${netDelta.toFixed(speedUnit === 'MBps' ? 2 : 1)}` : netDelta.toFixed(speedUnit === 'MBps' ? 2 : 1)} ${speedUnit}`
                    : metric === 'latency'
                      ? `ping ${netDelta >= 0 ? `+${netDelta.toFixed(0)}` : netDelta.toFixed(0)} ms`
                      : `score ${netDelta >= 0 ? `+${Math.round(netDelta)}` : Math.round(netDelta)} pts`
                }`
              : 'Historical performance trajectory across saved speed tests'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Legend */}
          {chronological.length >= 2 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-3 rounded-xs"
                  style={{backgroundColor: primaryColor}}
                  aria-hidden="true"
                />
                <span>
                  {metric === 'speed'
                    ? 'Download'
                    : metric === 'latency'
                      ? 'Ping'
                      : 'Veloxis Score'}
                </span>
              </span>
              {metric !== 'score' && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-3 rounded-xs"
                    style={{backgroundColor: secondaryColor}}
                    aria-hidden="true"
                  />
                  <span>{metric === 'speed' ? 'Upload' : 'Loaded Ping'}</span>
                </span>
              )}
            </div>
          )}

          {/* Metric Switcher */}
          <div
            role="group"
            aria-label="Trend metric selector"
            className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 p-1"
          >
            {(
              [
                {id: 'speed', label: 'Speed'},
                {id: 'latency', label: 'Latency'},
                {id: 'score', label: 'Score'},
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMetric(tab.id);
                  setHoverIdx(null);
                }}
                aria-pressed={metric === tab.id}
                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  metric === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chronological.length < 2 ? (
        <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Complete at least 2 speed tests to visualize download, upload, latency, and score trends over time.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${metric}-${speedUnit}-${chronological.length}`}
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            className="relative"
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[216px] cursor-crosshair select-none"
              onMouseLeave={() => setHoverIdx(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = ((e.clientX - rect.left) / rect.width) * width;
                const clamped = Math.max(pad.left, Math.min(pad.left + plotW, relX));
                const ratio = (clamped - pad.left) / plotW;
                const idx = Math.round(ratio * Math.max(0, series.length - 1));
                setHoverIdx(idx);
              }}
            >
              <defs>
                <linearGradient id={`trendFill_${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={primaryColor}
                    stopOpacity={isDark ? '0.24' : '0.16'}
                  />
                  <stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {yTicks.map((tick) => {
                const y = yForVal(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={pad.left}
                      y1={y}
                      x2={pad.left + plotW}
                      y2={y}
                      stroke={gridStroke}
                      strokeWidth="1"
                      strokeDasharray={tick === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={pad.left - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                    >
                      {Math.round(tick)}
                    </text>
                  </g>
                );
              })}

              {primaryAreaPath && (
                <motion.path
                  d={primaryAreaPath}
                  fill={`url(#trendFill_${metric})`}
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  transition={{duration: 0.35}}
                />
              )}

              {primaryPath && (
                <motion.path
                  d={primaryPath}
                  fill="none"
                  stroke={primaryColor}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{pathLength: 0, opacity: 0.4}}
                  animate={{pathLength: 1, opacity: 1}}
                  transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                />
              )}

              {secondaryPath && (
                <motion.path
                  d={secondaryPath}
                  fill="none"
                  stroke={secondaryColor}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={metric === 'latency' ? '4 3' : undefined}
                  initial={{pathLength: 0, opacity: 0.4}}
                  animate={{pathLength: 1, opacity: 1}}
                  transition={{duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
                />
              )}

              {/* Data Points */}
              {series.map((pt, idx) => (
                <g key={pt.item.id}>
                  <circle
                    cx={xForIdx(idx)}
                    cy={yForVal(pt.primary)}
                    r={hoverIdx === idx ? 4.5 : 3}
                    fill={primaryColor}
                    stroke={dotStroke}
                    strokeWidth="1.5"
                  />
                  {pt.secondary !== null && (
                    <circle
                      cx={xForIdx(idx)}
                      cy={yForVal(pt.secondary)}
                      r={hoverIdx === idx ? 4 : 2.5}
                      fill={secondaryColor}
                      stroke={dotStroke}
                      strokeWidth="1.2"
                    />
                  )}
                </g>
              ))}

              {hoverIdx !== null && activePt && (
                <line
                  x1={xForIdx(hoverIdx)}
                  y1={pad.top}
                  x2={xForIdx(hoverIdx)}
                  y2={pad.top + plotH}
                  stroke={crosshairStroke}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* X-axis earliest & latest dates */}
              <text
                x={pad.left}
                y={height - 6}
                textAnchor="start"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {new Date(chronological[0].timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </text>
              <text
                x={pad.left + plotW}
                y={height - 6}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {new Date(
                  chronological[chronological.length - 1].timestamp,
                ).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </text>
            </svg>

            <AnimatePresence>
              {activePt && (
                <motion.div
                  initial={{opacity: 0, y: 4}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.14}}
                  className="pointer-events-none absolute right-3 top-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-200 shadow-xs"
                >
                  <span>
                    {new Date(activePt.item.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {metric === 'speed' && (
                    <>
                      <span className="ml-2.5 text-blue-600 dark:text-blue-400">
                        DL {formatSpeedValue(activePt.item.downloadMbps, speedUnit)} {speedUnit}
                      </span>
                      <span className="ml-2.5 text-cyan-700 dark:text-cyan-400">
                        UL {formatSpeedValue(activePt.item.uploadMbps, speedUnit)} {speedUnit}
                      </span>
                    </>
                  )}
                  {metric === 'latency' && (
                    <>
                      <span className="ml-2.5 text-amber-600 dark:text-amber-400">
                        Ping {activePt.item.pingMs.toFixed(0)} ms
                      </span>
                      <span className="ml-2.5 text-rose-600 dark:text-rose-400">
                        Loaded {activePt.item.loadedPingMs.toFixed(0)} ms
                      </span>
                    </>
                  )}
                  {metric === 'score' && (
                    <span className="ml-2.5 text-emerald-600 dark:text-emerald-400">
                      Score {activePt.item.veloxisScore} / 100
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.section>
  );
};
