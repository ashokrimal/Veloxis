import React from 'react';
import {motion} from 'motion/react';
import {AnimatedNumber} from './AnimatedNumber';

interface CircularProgressMetricProps {
  label: string;
  value: number | null;
  unit?: string;
  progress: number; // 0 to 1
  tone: 'blue' | 'lime' | 'sky' | 'emerald' | 'amber' | 'rose';
  decimals?: number;
  adaptiveDecimals?: boolean;
  subtitle?: string;
  secondarySubtitle?: string;
  active?: boolean;
  dimmed?: boolean;
  size?: number;
  emphasis?: 'primary' | 'summary';
}

const TONE_MAP = {
  blue: {
    stroke: 'stroke-[#1D4ED8] dark:stroke-[#38BDF8]',
    text: 'text-[#1D4ED8] dark:text-[#38BDF8]',
  },
  lime: {
    stroke: 'stroke-[#65A30D] dark:stroke-[#A3E635]',
    text: 'text-[#65A30D] dark:text-[#A3E635]',
  },
  sky: {
    stroke: 'stroke-sky-600 dark:stroke-sky-400',
    text: 'text-sky-700 dark:text-sky-400',
  },
  emerald: {
    stroke: 'stroke-emerald-600 dark:stroke-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  amber: {
    stroke: 'stroke-amber-600 dark:stroke-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
  },
  rose: {
    stroke: 'stroke-rose-600 dark:stroke-rose-400',
    text: 'text-rose-700 dark:text-rose-400',
  },
} as const;

export const CircularProgressMetric: React.FC<CircularProgressMetricProps> = ({
  label,
  value,
  unit,
  progress,
  tone,
  decimals = 1,
  adaptiveDecimals = false,
  subtitle,
  secondarySubtitle,
  active = false,
  dimmed = false,
  size = 116,
  emphasis = 'primary',
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const strokeWidth = emphasis === 'primary' ? 7.5 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const palette = TONE_MAP[tone];

  return (
    <motion.div
      animate={{
        opacity: dimmed ? 0.55 : 1,
        scale: active ? 1.02 : 1,
      }}
      transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
      className="flex flex-col items-center text-center"
    >
      <div className="relative flex items-center justify-center" style={{width: size, height: size}}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${value !== null ? value.toFixed(decimals) : '--'} ${unit || ''}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-[#EAE6DD] dark:stroke-[#1E2942]"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{strokeDashoffset: offset}}
            transition={{type: 'spring', stiffness: 120, damping: 20, mass: 0.7}}
            className={palette.stroke}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            adaptiveDecimals={adaptiveDecimals}
            className={`font-mono ${
              emphasis === 'primary' ? 'text-[22px]' : 'text-xl'
            } font-bold tracking-tight tabular-nums leading-none ${
              active
                ? palette.text
                : 'text-stone-900 dark:text-slate-50'
            }`}
          />
          {unit && (
            <span className="mt-1 font-mono text-[10px] font-medium tracking-wide text-stone-400 dark:text-slate-500">
              {unit}
            </span>
          )}
        </div>
      </div>

      <div
        className={`mt-2.5 text-xs ${
          emphasis === 'primary'
            ? 'font-semibold text-stone-900 dark:text-slate-100'
            : 'font-medium text-stone-600 dark:text-slate-300'
        }`}
      >
        {label}
      </div>
      {subtitle && (
        <div
          className={`mt-0.5 text-[11px] font-medium ${
            value !== null || active
              ? palette.text
              : 'text-stone-400 dark:text-slate-500'
          }`}
        >
          {subtitle}
        </div>
      )}
      {secondarySubtitle && (
        <div className="mt-0.5 font-mono text-[10.5px] font-medium text-stone-500 dark:text-slate-400 tabular-nums">
          {secondarySubtitle}
        </div>
      )}
    </motion.div>
  );
};
