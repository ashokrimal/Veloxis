import React, {useEffect} from 'react';
import {Clock, Play, RotateCcw, Square} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import type {SpeedUnit, TestPhase, TransferProgress} from '../types/speedtest';
import {
  convertSpeed,
  formatDuration,
  formatTransferSize,
  speedToNormalized,
} from '../utils/scoring';
import {AnimatedNumber} from './AnimatedNumber';

interface PrecisionGaugeProps {
  phase: TestPhase;
  progressPct: number;
  liveSpeedMbps: number;
  speedCaption?: string;
  downloadProgress?: number;
  uploadProgress?: number;
  speedUnit: SpeedUnit;
  transferProgress?: TransferProgress | null;
  elapsedSeconds?: number;
  estimatedRemainingSeconds?: number | null;
  estimatedTotalSeconds?: number | null;
  lastDurationSec?: number | null;
  isDark?: boolean;
  onStart: () => void;
  onCancel: () => void;
  actionLabel?: string;
}

function getPhaseLabel(
  phase: TestPhase,
  transferProgress?: TransferProgress | null,
): string {
  switch (phase) {
    case 'ping':
      return 'Measuring Latency & Jitter';
    case 'download':
      return transferProgress
        ? `Downloading ${formatTransferSize(transferProgress.targetBytes)} File`
        : 'Testing Download Bandwidth';
    case 'upload':
      return transferProgress
        ? `Uploading ${formatTransferSize(transferProgress.targetBytes)} File`
        : 'Testing Upload Bandwidth';
    case 'complete':
      return 'Measurement Complete';
    case 'monitoring':
      return 'Real-Time Stream Active';
    case 'error':
      return 'Connection Interrupted';
    default:
      return 'Ready to Measure';
  }
}

export const PrecisionGauge: React.FC<PrecisionGaugeProps> = ({
  phase,
  progressPct,
  liveSpeedMbps,
  speedCaption,
  downloadProgress,
  uploadProgress,
  speedUnit,
  transferProgress = null,
  elapsedSeconds = 0,
  estimatedRemainingSeconds = null,
  estimatedTotalSeconds = null,
  lastDurationSec = null,
  isDark = false,
  onStart,
  onCancel,
  actionLabel,
}) => {
  const isRunning = phase === 'ping' || phase === 'download' || phase === 'upload';
  const isLiveArcActive = isRunning || phase === 'monitoring';
  const normalized = isLiveArcActive ? speedToNormalized(liveSpeedMbps) : 0;
  const displayedValue = convertSpeed(liveSpeedMbps, speedUnit);

  const computedDlProgress =
    typeof downloadProgress === 'number'
      ? Math.max(0, Math.min(1, downloadProgress))
      : phase === 'download'
        ? normalized
        : phase === 'upload' || phase === 'complete'
          ? 1
          : 0;

  const computedUlProgress =
    typeof uploadProgress === 'number'
      ? Math.max(0, Math.min(1, uploadProgress))
      : phase === 'upload'
        ? normalized
        : phase === 'complete'
          ? 1
          : 0;

  const rawNormalized = useMotionValue(normalized);
  const smoothNormalized = useSpring(rawNormalized, {
    stiffness: 130,
    damping: 22,
    mass: 0.7,
  });

  const rawDlProgress = useMotionValue(computedDlProgress);
  const smoothDlProgress = useSpring(rawDlProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.6,
  });

  const rawUlProgress = useMotionValue(computedUlProgress);
  const smoothUlProgress = useSpring(rawUlProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.6,
  });

  useEffect(() => {
    rawNormalized.set(normalized);
  }, [normalized, rawNormalized]);

  useEffect(() => {
    rawDlProgress.set(computedDlProgress);
  }, [computedDlProgress, rawDlProgress]);

  useEffect(() => {
    rawUlProgress.set(computedUlProgress);
  }, [computedUlProgress, rawUlProgress]);

  const cx = 160;
  const cy = 148;
  const radius = 114;
  const dlRingRadius = 128;
  const ulRingRadius = 136;
  const startAngle = (150 * Math.PI) / 180;
  const totalSweep = (240 * Math.PI) / 180;

  const arcPoint = (angle: number, r = radius) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const startPt = arcPoint(startAngle);
  const endPt = arcPoint(startAngle + totalSweep);
  const fullTrackPath = `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

  const dlStartPt = arcPoint(startAngle, dlRingRadius);
  const dlEndPt = arcPoint(startAngle + totalSweep, dlRingRadius);
  const dlTrackPath = `M ${dlStartPt.x.toFixed(2)} ${dlStartPt.y.toFixed(2)} A ${dlRingRadius} ${dlRingRadius} 0 1 1 ${dlEndPt.x.toFixed(2)} ${dlEndPt.y.toFixed(2)}`;

  const ulStartPt = arcPoint(startAngle, ulRingRadius);
  const ulEndPt = arcPoint(startAngle + totalSweep, ulRingRadius);
  const ulTrackPath = `M ${ulStartPt.x.toFixed(2)} ${ulStartPt.y.toFixed(2)} A ${ulRingRadius} ${ulRingRadius} 0 1 1 ${ulEndPt.x.toFixed(2)} ${ulEndPt.y.toFixed(2)}`;

  const needleX = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cx + radius * Math.cos(ang);
  });
  const needleY = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cy + radius * Math.sin(ang);
  });
  const needleOpacity = useTransform(smoothNormalized, (n) => (n > 0.004 ? 1 : 0));

  const downloadStroke = isDark ? '#38BDF8' : '#1D4ED8';
  const uploadStroke = isDark ? '#A3E635' : '#65A30D';
  const accentStroke = phase === 'upload' ? uploadStroke : downloadStroke;

  const tickMarks =
    speedUnit === 'MBps'
      ? [
          {mbps: 0, label: '0'},
          {mbps: 8, label: '1'},
          {mbps: 40, label: '5'},
          {mbps: 100, label: '12.5'},
          {mbps: 240, label: '30'},
          {mbps: 500, label: '62.5'},
          {mbps: 1000, label: '125'},
        ]
      : [
          {mbps: 0, label: '0'},
          {mbps: 10, label: '10'},
          {mbps: 50, label: '50'},
          {mbps: 100, label: '100'},
          {mbps: 250, label: '250'},
          {mbps: 500, label: '500'},
          {mbps: 1000, label: '1G'},
        ];

  return (
    <div className="flex w-full flex-col items-center justify-center py-1">
      {/* Status text cleanly positioned OUTSIDE and above the gauge */}
      <div className="mb-2 flex min-h-6 items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${transferProgress ? 'file' : 'std'}`}
            initial={{opacity: 0, y: 4}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -4}}
            transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-stone-600 dark:text-slate-300"
          >
            {isRunning && (
              <motion.span
                animate={{opacity: [0.45, 1, 0.45]}}
                transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut'}}
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  phase === 'upload'
                    ? 'bg-[#65A30D] dark:bg-[#A3E635]'
                    : 'bg-[#1D4ED8] dark:bg-[#38BDF8]'
                }`}
                aria-hidden="true"
              />
            )}
            <span>{getPhaseLabel(phase, transferProgress)}</span>
            {isRunning && (
              <span className="font-mono text-stone-400 dark:text-slate-500 tabular-nums">
                · {progressPct}%
              </span>
            )}
            {transferProgress && isRunning && (
              <span className="font-mono text-stone-500 dark:text-slate-400 tabular-nums">
                · {formatTransferSize(transferProgress.bytes)} /{' '}
                {formatTransferSize(transferProgress.targetBytes)}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative w-full max-w-[332px]">
        <svg
          viewBox="0 0 320 246"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Speed gauge showing ${displayedValue.toFixed(1)} ${speedUnit}`}
        >
          {/* Outer Lime Upload progress arc */}
          <path
            d={ulTrackPath}
            fill="none"
            className="stroke-[#EAE6DD] dark:stroke-[#1E2942]/70"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <motion.path
            d={ulTrackPath}
            fill="none"
            stroke={uploadStroke}
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              pathLength: smoothUlProgress,
              opacity: computedUlProgress > 0 ? 0.92 : 0,
            }}
          />

          {/* Inner-outer Blue/Cyan Download progress arc */}
          <path
            d={dlTrackPath}
            fill="none"
            className="stroke-[#EAE6DD] dark:stroke-[#1E2942]/80"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <motion.path
            d={dlTrackPath}
            fill="none"
            stroke={downloadStroke}
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              pathLength: smoothDlProgress,
              opacity: computedDlProgress > 0 ? 0.92 : 0,
            }}
          />

          {/* Hairline tick marks */}
          {tickMarks.map((mark) => {
            const norm = speedToNormalized(mark.mbps);
            const ang = startAngle + totalSweep * norm;
            const inner = arcPoint(ang, radius - 16);
            const outer = arcPoint(ang, radius - 10);
            const labelPt = arcPoint(ang, radius - 30);
            return (
              <g key={mark.label}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  className="stroke-[#D6D0C4] dark:stroke-[#334155]"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-stone-400 dark:fill-slate-500 text-[9.5px] font-mono tabular-nums"
                >
                  {mark.label}
                </text>
              </g>
            );
          })}

          {/* Track arc */}
          <path
            d={fullTrackPath}
            fill="none"
            className="stroke-[#EAE6DD] dark:stroke-[#1E2942]"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Smooth spring-animated telemetry speed arc */}
          <motion.path
            d={fullTrackPath}
            fill="none"
            stroke={accentStroke}
            strokeWidth="11"
            strokeLinecap="round"
            style={{
              pathLength: smoothNormalized,
              opacity: needleOpacity,
            }}
            className="transition-[stroke] duration-200"
          />

          {/* Spring-animated needle indicator tip */}
          <motion.circle
            cx={needleX}
            cy={needleY}
            r="5.5"
            className="fill-white dark:fill-[#0D1322]"
            stroke={accentStroke}
            strokeWidth="3"
            style={{opacity: needleOpacity}}
          />
        </svg>

        {/* Center numeric readout */}
        <div className="pointer-events-none absolute inset-x-0 top-[104px] flex flex-col items-center text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <AnimatedNumber
              value={displayedValue}
              adaptiveDecimals={speedUnit === 'Mbps'}
              decimals={speedUnit === 'MBps' ? (displayedValue < 10 ? 2 : 1) : 1}
              className="font-mono text-5xl font-bold tracking-tight text-stone-900 dark:text-slate-50 tabular-nums"
            />
            <span className="font-mono text-xs font-semibold tracking-wide text-stone-500 dark:text-slate-400">
              {speedUnit}
            </span>
          </div>
          {speedCaption && (
            <div className="mt-1 font-mono text-[10.5px] font-semibold tracking-wide text-stone-500 dark:text-slate-400">
              {speedCaption}
            </div>
          )}
          <div className="mt-2 flex items-center gap-3.5 text-[11px] font-medium text-stone-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-[#1D4ED8] dark:bg-[#38BDF8]" aria-hidden="true" />
              <span>Download</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-[#65A30D] dark:bg-[#A3E635]" aria-hidden="true" />
              <span>Upload</span>
            </span>
          </div>
        </div>
      </div>

      {/* Primary Action Control */}
      <div className="mt-1.5 flex items-center gap-3">
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.button
              key="stop-btn"
              type="button"
              onClick={onCancel}
              initial={{opacity: 0, scale: 0.96}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.96}}
              whileTap={{scale: 0.97}}
              transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
              className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-[#131C31] px-6 py-2.5 text-sm font-semibold text-stone-900 dark:text-slate-100 hover:bg-[#F8F7F4] dark:hover:bg-[#1E2942] vx-btn-secondary transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] dark:focus-visible:outline-[#38BDF8]"
            >
              <Square className="h-3.5 w-3.5 fill-stone-800 text-stone-800 dark:fill-slate-200 dark:text-slate-200" aria-hidden="true" />
              <span>Stop Test</span>
            </motion.button>
          ) : (
            <motion.button
              key="start-btn"
              type="button"
              onClick={onStart}
              initial={{opacity: 0, scale: 0.96}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.96}}
              whileTap={{scale: 0.98}}
              transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-7 py-3 text-sm font-semibold text-white dark:text-slate-950 vx-btn-primary transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] dark:focus-visible:outline-[#38BDF8]"
            >
              {phase === 'complete' ? (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              )}
              <span>
                {actionLabel || (phase === 'complete' ? 'Run Again' : 'Start Speed Test')}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Time Taken & Estimated Time Telemetry Readout */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-stone-500 dark:text-slate-400">
        {isRunning ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-stone-400 dark:text-slate-500" aria-hidden="true" />
              <span>
                Elapsed{' '}
                <strong className="font-semibold text-stone-900 dark:text-slate-200">
                  {formatDuration(elapsedSeconds)}
                </strong>
              </span>
            </span>
            <span className="text-stone-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>
              Est. Remaining{' '}
              <strong className="font-semibold text-[#1D4ED8] dark:text-[#38BDF8]">
                {estimatedRemainingSeconds !== null
                  ? `~${formatDuration(estimatedRemainingSeconds, false)}`
                  : 'calculating...'}
              </strong>
            </span>
          </>
        ) : lastDurationSec !== null ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-stone-400 dark:text-slate-500" aria-hidden="true" />
              <span>
                Time Taken{' '}
                <strong className="font-semibold text-stone-900 dark:text-slate-200">
                  {formatDuration(lastDurationSec)}
                </strong>
              </span>
            </span>
            {estimatedTotalSeconds !== null && (
              <>
                <span className="text-stone-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span>
                  Est. Duration{' '}
                  <strong className="font-medium text-stone-700 dark:text-slate-300">
                    ~{formatDuration(estimatedTotalSeconds, false)}
                  </strong>
                </span>
              </>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-stone-400 dark:text-slate-500" aria-hidden="true" />
            <span>
              Estimated Time{' '}
              <strong className="font-semibold text-stone-700 dark:text-slate-300">
                {estimatedTotalSeconds !== null
                  ? `~${formatDuration(estimatedTotalSeconds, false)}`
                  : 'depends on speed'}
              </strong>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
