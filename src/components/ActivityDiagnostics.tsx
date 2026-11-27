import React from 'react';
import {AlertTriangle, CheckCircle2, Gamepad2, Globe, Tv} from 'lucide-react';
import {motion} from 'motion/react';
import type {ActivityVerdict, SpeedUnit, VerdictTier} from '../types/speedtest';
import {formatSpeedValue} from '../utils/scoring';

interface ActivityDiagnosticsProps {
  activities: ActivityVerdict[] | null;
  isTesting: boolean;
  speedUnit: SpeedUnit;
  measuredUploadMbps?: number;
}

function getTierStyles(tier: VerdictTier) {
  switch (tier) {
    case 'Optimal':
      return {text: 'text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2};
    case 'Good':
      return {text: 'text-blue-700 dark:text-blue-400', Icon: CheckCircle2};
    case 'Fair':
      return {text: 'text-amber-700 dark:text-amber-400', Icon: AlertTriangle};
    default:
      return {text: 'text-rose-700 dark:text-rose-400', Icon: AlertTriangle};
  }
}

function getActivityIcon(id: ActivityVerdict['id']) {
  switch (id) {
    case 'streaming':
      return Tv;
    case 'gaming':
      return Gamepad2;
    default:
      return Globe;
  }
}

export const ActivityDiagnostics: React.FC<ActivityDiagnosticsProps> = ({
  activities,
  isTesting,
  speedUnit,
  measuredUploadMbps,
}) => {
  if (!activities) {
    return (
      <section
        aria-label="Activity readiness diagnostics"
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
      >
        {[
          {title: '4K & HD Streaming', desc: 'Evaluates sustained download speed and buffer margin.'},
          {title: 'Online Gaming', desc: 'Evaluates ping, jitter, and latency under load.'},
          {title: 'Browsing & Calls', desc: 'Evaluates upload headroom and responsiveness.'},
        ].map((item, idx) => (
          <motion.div
            key={item.title}
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.22, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] transition-colors duration-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold leading-snug tracking-[0.005em] text-slate-900 dark:text-slate-50">
                  {item.title}
                </h3>
                <span className="font-mono text-xs tracking-[0.02em] text-slate-400 dark:text-slate-500">
                  {isTesting ? 'Measuring...' : 'Ready'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-[1.65] tracking-[0.005em] text-slate-500 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 px-6 py-3.5 text-xs tracking-[0.015em] text-slate-400 dark:text-slate-500">
              Awaiting test run
            </div>
          </motion.div>
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Activity readiness diagnostics"
      className="grid grid-cols-1 gap-5 md:grid-cols-3"
    >
      {activities.map((act, idx) => {
        const {text, Icon} = getTierStyles(act.tier);
        const CategoryIcon = getActivityIcon(act.id);

        return (
          <motion.div
            key={act.id}
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            whileHover={{y: -2}}
            transition={{duration: 0.22, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] transition-colors duration-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-50">
                  <CategoryIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-semibold leading-snug tracking-[0.005em]">
                    {act.title}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold tracking-[0.015em] whitespace-nowrap shrink-0 ${text}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{act.tier}</span>
                </span>
              </div>

              <p className="mt-3.5 text-sm leading-[1.65] tracking-[0.005em] text-slate-600 dark:text-slate-300">
                {act.summary}
              </p>
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/60 px-6 py-3.5">
              <span className="text-xs leading-snug tracking-[0.015em] text-slate-500 dark:text-slate-400">
                {act.metricLabel}
              </span>
              <span className="font-mono text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                {act.id === 'browsing' && measuredUploadMbps !== undefined && measuredUploadMbps > 0
                  ? `${formatSpeedValue(measuredUploadMbps, speedUnit)} ${speedUnit}`
                  : act.metricValue}
              </span>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
};
