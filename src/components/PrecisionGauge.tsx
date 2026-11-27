import React, {useEffect} from 'react';
import {Play, RotateCcw, Square} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import type {TestPhase} from '../types/speedtest';
import {AnimatedNumber} from './AnimatedNumber';

interface PrecisionGaugeProps {
  phase: TestPhase;
  progressPct: number;
  liveSpeedMbps: number;
  onStart: () => void;
  onCancel: () => void;
}

const SCALE_MAX = 1000;

function speedToNormalized(mbps: number): number {
  if (mbps <= 0) return 0;
  const clamped = Math.min(SCALE_MAX, Math.max(0, mbps));
  return Math.min(1, Math.log10(clamped + 1) / Math.log10(SCALE_MAX + 1));
}

function getPhaseLabel(phase: TestPhase): string {
  switch (phase) {
    case 'ping':
      return 'Measuring Latency & Jitter';
    case 'download':
      return 'Testing Download Bandwidth';
    case 'upload':
      return 'Testing Upload Bandwidth';
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
  onStart,
  onCancel,
}) => {
  const isRunning = phase === 'ping' || phase === 'download' || phase === 'upload';
  const normalized = speedToNormalized(liveSpeedMbps);

  // Smooth spring animation for gauge arc sweep & needle tip
  const rawNormalized = useMotionValue(normalized);
  const smoothNormalized = useSpring(rawNormalized, {
    stiffness: 130,
    damping: 22,
    mass: 0.7,
  });

  useEffect(() => {
    rawNormalized.set(normalized);
  }, [normalized, rawNormalized]);

  // SVG semi-circular arc geometry (240 deg sweep from 150 deg to 390 deg)
  const cx = 160;
  const cy = 148;
  const radius = 116;
  const startAngle = (150 * Math.PI) / 180;
  const totalSweep = (240 * Math.PI) / 180;

  const arcPoint = (angle: number, r = radius) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const startPt = arcPoint(startAngle);
  const endPt = arcPoint(startAngle + totalSweep);
  const fullTrackPath = `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

  const needleX = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cx + radius * Math.cos(ang);
  });
  const needleY = useTransform(smoothNormalized, (n) => {
    const ang = startAngle + totalSweep * n;
    return cy + radius * Math.sin(ang);
  });
  const needleOpacity = useTransform(smoothNormalized, (n) => (n > 0.004 ? 1 : 0));

  const accentStroke = phase === 'upload' ? '#0891B2' : '#2563EB';
  const tickMarks = [0, 10, 50, 100, 250, 500, 1000];

  const targetProgress = isRunning
    ? Math.max(0.03, progressPct / 100)
    : phase === 'complete'
      ? 1
      : 0;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-full max-w-[340px]">
        <svg
          viewBox="0 0 320 248"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Speed gauge showing ${liveSpeedMbps.toFixed(1)} Mbps`}
        >
          {/* Outer hairline tick marks */}
          {tickMarks.map((mark) => {
            const norm = speedToNormalized(mark);
            const ang = startAngle + totalSweep * norm;
            const inner = arcPoint(ang, radius - 16);
            const outer = arcPoint(ang, radius - 10);
            const labelPt = arcPoint(ang, radius - 30);
            return (
              <g key={mark}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 text-[9.5px] font-mono tabular-nums"
                >
                  {mark === 1000 ? '1G' : mark}
                </text>
              </g>
            );
          })}

          {/* Track arc */}
          <path
            d={fullTrackPath}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Smooth spring-animated telemetry arc */}
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
            fill="#FFFFFF"
            stroke={accentStroke}
            strokeWidth="3"
            style={{opacity: needleOpacity}}
          />
        </svg>

        {/* Center numeric readout */}
        <div className="absolute inset-x-0 top-[82px] flex flex-col items-center text-center">
          <div className="h-5 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{opacity: 0, y: 4}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -4}}
                transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              >
                {isRunning && (
                  <motion.span
                    animate={{opacity: [0.45, 1, 0.45]}}
                    transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut'}}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      phase === 'upload' ? 'bg-cyan-600' : 'bg-blue-600'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span>{getPhaseLabel(phase)}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
            <AnimatedNumber
              value={liveSpeedMbps}
              adaptiveDecimals
              className="font-mono text-5xl font-bold tracking-tight text-slate-900 tabular-nums"
            />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mbps
            </span>
          </div>

          {/* Framer Motion spring-animated progress bar */}
          <div className="mt-4 h-1.5 w-38 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className={`h-full w-full origin-left rounded-full ${
                phase === 'upload' ? 'bg-cyan-600' : 'bg-blue-600'
              }`}
              initial={false}
              animate={{
                scaleX: targetProgress,
                opacity: targetProgress > 0 ? 1 : 0,
              }}
              transition={{
                scaleX: {type: 'spring', stiffness: 120, damping: 20, mass: 0.5},
                opacity: {duration: 0.2},
              }}
            />
          </div>
        </div>
      </div>

      {/* Primary Action Control with smooth idle <-> active transition */}
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Square className="h-3.5 w-3.5 fill-slate-700 text-slate-700" aria-hidden="true" />
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {phase === 'complete' ? (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-white" aria-hidden="true" />
              )}
              <span>{phase === 'complete' ? 'Run Again' : 'Start Speed Test'}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
