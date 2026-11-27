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
import {convertSpeed, formatDuration, formatTransferSize} from '../utils/scoring';
import {AnimatedNumber} from './AnimatedNumber';

interface PrecisionGaugeProps {
  phase: TestPhase;
  progressPct: number;
  liveSpeedMbps: number;
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

const SCALE_MAX = 1000;

function speedToNormalized(mbps: number): number {
  if (mbps <= 0) return 0;
  const clamped = Math.min(SCALE_MAX, Math.max(0, mbps));
  return Math.min(1, Math.log10(clamped + 1) / Math.log10(SCALE_MAX + 1));
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
  const normalized = speedToNormalized(liveSpeedMbps);
  const displayedValue = convertSpeed(liveSpeedMbps, speedUnit);

  const rawNormalized = useMotionValue(normalized);
  const smoothNormalized = useSpring(rawNormalized, {
    stiffness: 130,
    damping: 22,
    mass: 0.7,
  });

  const rawProgress = useMotionValue(isRunning ? progressPct / 100 : phase === 'complete' ? 1 : 0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.6,
  });

  useEffect(() => {
    rawNormalized.set(normalized);
  }, [normalized, rawNormalized]);

  useEffect(() => {
    const target = isRunning
      ? Math.max(0.02, progressPct / 100)
      : phase === 'complete'
        ? 1
        : 0;
    rawProgress.set(target);
  }, [isRunning, phase, progressPct, rawProgress]);

  const cx = 160;
  const cy = 148;
  const radius = 116;
  const progressRadius = 128;
  const startAngle = (150 * Math.PI) / 180;
  const totalSweep = (240 * Math.PI) / 180;

  const arcPoint = (angle: number, r = radius) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const startPt = arcPoint(startAngle);
  const endPt = arcPoint(startAngle + totalSweep);
  const fullTrackPath = `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

  const pStartPt = arcPoint(startAngle, progressRadius);
  const pEndPt = arcPoint(startAngle + totalSweep, progressRadius);
  const outerProgressTrackPath = `M ${pStartPt.x.toFixed(2)} ${pStartPt.y.toFixed(2)} A ${progressRadius} ${progressRadius} 0 1 1 ${pEndPt.x.toFixed(2)} ${pEndPt.y.toFixed(2)}`;

  const needleX = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cx + radius * Math.cos(ang);
  });
  const needleY = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cy + radius * Math.sin(ang);
  });
  const needleOpacity = useTransform(smoothNormalized, (n) => (n > 0.004 ? 1 : 0));

  const accentStroke =
    phase === 'upload'
      ? isDark
        ? '#22D3EE'
        : '#0891B2'
      : isDark
        ? '#3B82F6'
        : '#2563EB';

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
      {/* Status text cleanly positioned OUTSIDE and above the half-circle gauge */}
      <div className="mb-2 flex min-h-6 items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${transferProgress ? 'file' : 'std'}`}
            initial={{opacity: 0, y: 4}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -4}}
            transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            {isRunning && (
              <motion.span
                animate={{opacity: [0.45, 1, 0.45]}}
                transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut'}}
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  phase === 'upload'
                    ? 'bg-cyan-600 dark:bg-cyan-400'
                    : 'bg-blue-600 dark:bg-blue-400'
                }`}
                aria-hidden="true"
              />
            )}
            <span>{getPhaseLabel(phase, transferProgress)}</span>
            {isRunning && (
              <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                · {progressPct}%
              </span>
            )}
            {transferProgress && isRunning && (
              <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                · {formatTransferSize(transferProgress.bytes)} /{' '}
                {formatTransferSize(transferProgress.targetBytes)}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative w-full max-w-[332px]">
        <svg
          viewBox="0 0 320 242"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Speed gauge showing ${displayedValue.toFixed(1)} ${speedUnit}`}
        >
          {/* Outer circular test progress ring */}
          <path
            d={outerProgressTrackPath}
            fill="none"
            className="stroke-slate-100 dark:stroke-slate-800/70"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <motion.path
            d={outerProgressTrackPath}
            fill="none"
            stroke={accentStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              pathLength: smoothProgress,
              opacity: isRunning || phase === 'complete' ? 0.7 : 0,
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
                  className="stroke-slate-300 dark:stroke-slate-700"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 dark:fill-slate-500 text-[9.5px] font-mono tabular-nums"
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
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Smooth spring-animated telemetry speed arc */}
          <motion.path
            d={fullTrackPath}
            fill="none"
            stroke={accentStroke}
            strokeWidth="12"
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
            className="fill-white dark:fill-[#111827]"
            stroke={accentStroke}
            strokeWidth="3"
            style={{opacity: needleOpacity}}
          />
        </svg>

        {/* Center numeric readout only — uncluttered inside the arc */}
        <div className="pointer-events-none absolute inset-x-0 top-[106px] flex flex-col items-center text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <AnimatedNumber
              value={displayedValue}
              adaptiveDecimals={speedUnit === 'Mbps'}
              decimals={speedUnit === 'MBps' ? (displayedValue < 10 ? 2 : 1) : 1}
              className="font-mono text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
            />
            <span className="font-mono text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              {speedUnit}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Action Control */}
      <div className="mt-1 flex items-center gap-3">
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
            >
              <Square className="h-3.5 w-3.5 fill-slate-700 text-slate-700 dark:fill-slate-200 dark:text-slate-200" aria-hidden="true" />
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-7 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
            >
              {phase === 'complete' ? (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-white" aria-hidden="true" />
              )}
              <span>
                {actionLabel || (phase === 'complete' ? 'Run Again' : 'Start Speed Test')}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Time Taken & Estimated Time Telemetry Readout */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        {isRunning ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <span>
                Elapsed{' '}
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDuration(elapsedSeconds)}
                </strong>
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>
              Est. Remaining{' '}
              <strong className="font-semibold text-blue-600 dark:text-blue-400">
                {estimatedRemainingSeconds !== null
                  ? `~${formatDuration(estimatedRemainingSeconds, false)}`
                  : 'calculating...'}
              </strong>
            </span>
          </>
        ) : lastDurationSec !== null ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <span>
                Time Taken{' '}
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDuration(lastDurationSec)}
                </strong>
              </span>
            </span>
            {estimatedTotalSeconds !== null && (
              <>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span>
                  Est. Duration{' '}
                  <strong className="font-medium text-slate-700 dark:text-slate-300">
                    ~{formatDuration(estimatedTotalSeconds, false)}
                  </strong>
                </span>
              </>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <span>
              Estimated Time{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
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
