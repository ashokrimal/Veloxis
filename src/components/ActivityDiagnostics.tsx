import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Gamepad2,
  Globe,
  Tv,
} from 'lucide-react';
import {motion} from 'motion/react';
import type {
  ActivityVerdict,
  SpeedUnit,
  TestPhase,
  VerdictTier,
} from '../types/speedtest';
import {formatSpeedValue} from '../utils/scoring';
import {BufferbloatAnalysisCard} from './BufferbloatAnalysisCard';
import {DnsBenchmarkCard} from './DnsBenchmarkCard';

interface ActivityDiagnosticsProps {
  activities: ActivityVerdict[] | null;
  isTesting: boolean;
  phase: TestPhase;
  speedUnit: SpeedUnit;
  measuredUploadMbps?: number;
  unloadedPingMs?: number | null;
  loadedPingMs?: number | null;
  downloadLoadedPingMs?: number | null;
  uploadLoadedPingMs?: number | null;
  showAdvanced?: boolean;
}

function getTierStyles(tier: VerdictTier) {
  switch (tier) {
    case 'Optimal':
      return {text: 'text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2};
    case 'Good':
      return {text: 'text-[#1D4ED8] dark:text-[#38BDF8]', Icon: CheckCircle2};
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
  phase,
  speedUnit,
  measuredUploadMbps,
  unloadedPingMs = null,
  loadedPingMs = null,
  downloadLoadedPingMs = null,
  uploadLoadedPingMs = null,
  showAdvanced = false,
}) => {
  return (
    <div className="space-y-5">
      {!activities ? (
        <section
          aria-label="Activity readiness diagnostics"
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {[
            {
              title: '4K & HD Streaming',
              desc: 'Evaluates sustained download speed and buffer margin.',
            },
            {
              title: 'Online Gaming',
              desc: 'Evaluates ping, jitter, and latency under load.',
            },
            {
              title: 'Browsing & Calls',
              desc: 'Evaluates upload headroom and responsiveness.',
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{
                duration: 0.22,
                delay: idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col justify-between overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] vx-card transition-colors duration-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-snug tracking-[0.005em] text-stone-900 dark:text-slate-50">
                    {item.title}
                  </h3>
                  <span className="font-mono text-xs tracking-[0.02em] text-stone-400 dark:text-slate-500">
                    {isTesting ? 'Measuring...' : 'Ready'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-[1.65] tracking-[0.005em] text-stone-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
              <div className="border-t border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-6 py-3.5 text-xs tracking-[0.015em] text-stone-400 dark:text-slate-500">
                Awaiting test run
              </div>
            </motion.div>
          ))}
        </section>
      ) : (
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
                transition={{
                  duration: 0.22,
                  delay: idx * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex flex-col justify-between overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] vx-card transition-colors duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-stone-900 dark:text-slate-50">
                      <CategoryIcon
                        className="h-4 w-4 text-stone-500 dark:text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
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

                  <p className="mt-3.5 text-sm leading-[1.65] tracking-[0.005em] text-stone-600 dark:text-slate-300">
                    {act.summary}
                  </p>
                </div>

                <div className="flex items-baseline justify-between gap-3 border-t border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-6 py-3.5">
                  <span className="text-xs leading-snug tracking-[0.015em] text-stone-500 dark:text-slate-400">
                    {act.metricLabel}
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-tight text-stone-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    {act.id === 'browsing' &&
                    measuredUploadMbps !== undefined &&
                    measuredUploadMbps > 0
                      ? `${formatSpeedValue(measuredUploadMbps, speedUnit)} ${speedUnit}`
                      : act.metricValue}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* Dedicated Bufferbloat Analysis in Diagnostics Section */}
      <BufferbloatAnalysisCard
        unloadedPingMs={unloadedPingMs}
        loadedPingMs={loadedPingMs}
        downloadLoadedPingMs={downloadLoadedPingMs}
        uploadLoadedPingMs={uploadLoadedPingMs}
        phase={phase}
        isTesting={isTesting}
      />

      {/* DNS Resolver Benchmark inside Advanced Diagnostics Area */}
      {showAdvanced && <DnsBenchmarkCard />}
    </div>
  );
};
