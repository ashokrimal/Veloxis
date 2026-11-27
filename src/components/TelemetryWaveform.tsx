import React, {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import type {SpeedUnit, TelemetrySample} from '../types/speedtest';
import {convertSpeed, formatSpeedValue} from '../utils/scoring';

interface TelemetryWaveformProps {
  samples: TelemetrySample[];
  title: string;
  subtitle: string;
  emptyHint: string;
  speedUnit: SpeedUnit;
  isDark?: boolean;
}

export const TelemetryWaveform: React.FC<TelemetryWaveformProps> = ({
  samples,
  title,
  subtitle,
  emptyHint,
  speedUnit,
  isDark = false,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dlColor = isDark ? '#60A5FA' : '#2563EB';
  const ulColor = isDark ? '#22D3EE' : '#0891B2';
  const gridStroke = isDark ? '#1E293B' : '#E2E8F0';
  const crosshairStroke = isDark ? '#64748B' : '#94A3B8';
  const dotStroke = isDark ? '#111827' : '#FFFFFF';

  const width = 640;
  const height = 210;
  const pad = {top: 18, right: 16, bottom: 26, left: 42};
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const dlPoints = samples
    .map((s, i) => ({
      i,
      val: s.downloadMbps !== null ? convertSpeed(s.downloadMbps, speedUnit) : null,
      t: s.t,
    }))
    .filter((p): p is {i: number; val: number; t: number} => p.val !== null);

  const ulPoints = samples
    .map((s, i) => ({
      i,
      val: s.uploadMbps !== null ? convertSpeed(s.uploadMbps, speedUnit) : null,
      t: s.t,
    }))
    .filter((p): p is {i: number; val: number; t: number} => p.val !== null);

  const pingPoints = samples
    .map((s, i) => ({i, val: s.pingMs, t: s.t}))
    .filter((p): p is {i: number; val: number; t: number} => p.val !== null);

  const step = speedUnit === 'MBps' ? 5 : 25;
  const maxSpeed = Math.max(
    step,
    ...dlPoints.map((p) => p.val),
    ...ulPoints.map((p) => p.val),
  );
  const yMax = Math.ceil(maxSpeed / step) * step;

  const xForIndex = (idx: number) => {
    if (samples.length <= 1) return pad.left;
    return pad.left + (idx / (samples.length - 1)) * plotW;
  };

  const yForSpeed = (mbps: number) => {
    const ratio = Math.min(1, Math.max(0, mbps / yMax));
    return pad.top + plotH - ratio * plotH;
  };

  const buildPath = (pts: Array<{i: number; val: number}>) => {
    if (pts.length === 0) return '';
    return pts
      .map((p, k) => `${k === 0 ? 'M' : 'L'} ${xForIndex(p.i).toFixed(1)} ${yForSpeed(p.val).toFixed(1)}`)
      .join(' ');
  };

  const buildAreaPath = (pts: Array<{i: number; val: number}>) => {
    if (pts.length < 2) return '';
    const line = buildPath(pts);
    const firstX = xForIndex(pts[0].i).toFixed(1);
    const lastX = xForIndex(pts[pts.length - 1].i).toFixed(1);
    const bottomY = (pad.top + plotH).toFixed(1);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const dlPath = buildPath(dlPoints);
  const dlArea = buildAreaPath(dlPoints);
  const ulPath = buildPath(ulPoints);

  const activeSample =
    hoverIdx !== null && samples[hoverIdx] ? samples[hoverIdx] : null;

  const yTicks = [0, yMax * 0.5, yMax];

  return (
    <motion.div
      initial={{opacity: 0, y: 8}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.24, ease: [0.16, 1, 0.3, 1]}}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 transition-colors duration-200"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-xs bg-blue-600 dark:bg-blue-400" aria-hidden="true" />
            <span>Download</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-xs bg-cyan-600 dark:bg-cyan-400" aria-hidden="true" />
            <span>Upload</span>
          </span>
          {pingPoints.length > 0 && (
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Latest Ping: {pingPoints[pingPoints.length - 1].val.toFixed(0)} ms
            </span>
          )}
        </div>
      </div>

      {samples.length === 0 ? (
        <div className="flex h-[210px] items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyHint}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-[210px] cursor-crosshair select-none"
            onMouseLeave={() => setHoverIdx(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * width;
              const clamped = Math.max(pad.left, Math.min(pad.left + plotW, relX));
              const ratio = (clamped - pad.left) / plotW;
              const idx = Math.round(ratio * Math.max(0, samples.length - 1));
              setHoverIdx(idx);
            }}
          >
            <defs>
              <linearGradient id="veloxisDlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dlColor} stopOpacity={isDark ? '0.24' : '0.18'} />
                <stop offset="100%" stopColor={dlColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {yTicks.map((tick) => {
              const y = yForSpeed(tick);
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

            {/* Download Area + Line */}
            {dlArea && <path d={dlArea} fill="url(#veloxisDlFill)" />}
            {dlPath && (
              <path
                d={dlPath}
                fill="none"
                stroke={dlColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Upload Line */}
            {ulPath && (
              <path
                d={ulPath}
                fill="none"
                stroke={ulColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Interactive Hairline Crosshair */}
            {hoverIdx !== null && activeSample && (
              <g>
                <line
                  x1={xForIndex(hoverIdx)}
                  y1={pad.top}
                  x2={xForIndex(hoverIdx)}
                  y2={pad.top + plotH}
                  stroke={crosshairStroke}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                {activeSample.downloadMbps !== null && (
                  <circle
                    cx={xForIndex(hoverIdx)}
                    cy={yForSpeed(convertSpeed(activeSample.downloadMbps, speedUnit))}
                    r="4"
                    fill={dlColor}
                    stroke={dotStroke}
                    strokeWidth="1.5"
                  />
                )}
                {activeSample.uploadMbps !== null && (
                  <circle
                    cx={xForIndex(hoverIdx)}
                    cy={yForSpeed(convertSpeed(activeSample.uploadMbps, speedUnit))}
                    r="4"
                    fill={ulColor}
                    stroke={dotStroke}
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )}

            {/* X-axis start/end labels */}
            <text
              x={pad.left}
              y={height - 6}
              textAnchor="start"
              className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
            >
              {samples[0].t.toFixed(1)}s
            </text>
            <text
              x={pad.left + plotW}
              y={height - 6}
              textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
            >
              {samples[samples.length - 1].t.toFixed(1)}s
            </text>
          </svg>

          {/* Compact HUD coordinate readout */}
          <AnimatePresence>
            {activeSample && (
              <motion.div
                initial={{opacity: 0, y: 4}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0}}
                transition={{duration: 0.14}}
                className="pointer-events-none absolute right-3 top-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-200 shadow-xs"
              >
                <span>t={activeSample.t.toFixed(1)}s</span>
                {activeSample.downloadMbps !== null && (
                  <span className="ml-2.5 text-blue-600 dark:text-blue-400">
                    DL {formatSpeedValue(activeSample.downloadMbps, speedUnit)} {speedUnit}
                  </span>
                )}
                {activeSample.uploadMbps !== null && (
                  <span className="ml-2.5 text-cyan-700 dark:text-cyan-400">
                    UL {formatSpeedValue(activeSample.uploadMbps, speedUnit)} {speedUnit}
                  </span>
                )}
                {activeSample.pingMs !== null && (
                  <span className="ml-2.5 text-slate-600 dark:text-slate-300">
                    Ping {activeSample.pingMs.toFixed(0)} ms
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
