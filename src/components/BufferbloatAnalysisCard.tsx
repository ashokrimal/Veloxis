import React from 'react';
import {Activity, ArrowDown, ArrowUp, Gauge, ShieldCheck, Wrench} from 'lucide-react';
import {motion} from 'motion/react';
import type {BufferbloatGrade, TestPhase} from '../types/speedtest';
import {evaluateBufferbloat} from '../utils/scoring';

interface BufferbloatAnalysisCardProps {
  unloadedPingMs: number | null;
  loadedPingMs: number | null;
  downloadLoadedPingMs?: number | null;
  uploadLoadedPingMs?: number | null;
  phase: TestPhase;
  isTesting: boolean;
}

const GRADE_TIERS: Array<{
  grade: BufferbloatGrade;
  threshold: string;
  label: string;
}> = [
  {grade: 'A+', threshold: '≤5 ms', label: 'Zero'},
  {grade: 'A', threshold: '≤15 ms', label: 'Minimal'},
  {grade: 'B', threshold: '≤30 ms', label: 'Low'},
  {grade: 'C', threshold: '≤60 ms', label: 'Moderate'},
  {grade: 'D', threshold: '≤120 ms', label: 'High'},
  {grade: 'F', threshold: '>120 ms', label: 'Severe'},
];

function getGradeCardClasses(grade: BufferbloatGrade): string {
  if (grade === 'A+' || grade === 'A') {
    return 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300';
  }
  if (grade === 'B') {
    return 'border-blue-200 dark:border-blue-900/70 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300';
  }
  if (grade === 'C') {
    return 'border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300';
  }
  return 'border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300';
}

function getTierHighlightClasses(grade: BufferbloatGrade): string {
  if (grade === 'A+' || grade === 'A') {
    return 'border-emerald-500/70 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300';
  }
  if (grade === 'B') {
    return 'border-blue-500/70 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300';
  }
  if (grade === 'C') {
    return 'border-amber-500/70 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300';
  }
  return 'border-rose-500/70 dark:border-rose-500/60 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300';
}

export const BufferbloatAnalysisCard: React.FC<BufferbloatAnalysisCardProps> = ({
  unloadedPingMs,
  loadedPingMs,
  downloadLoadedPingMs = null,
  uploadLoadedPingMs = null,
  phase,
  isTesting,
}) => {
  const hasIdle = unloadedPingMs !== null && unloadedPingMs > 0;
  const hasLoaded = loadedPingMs !== null && loadedPingMs > 0;
  const bloat =
    hasIdle && hasLoaded
      ? evaluateBufferbloat(unloadedPingMs, loadedPingMs)
      : null;

  const dlDeltaMs =
    hasIdle && downloadLoadedPingMs !== null && downloadLoadedPingMs > 0
      ? Math.max(0, downloadLoadedPingMs - unloadedPingMs)
      : null;
  const ulDeltaMs =
    hasIdle && uploadLoadedPingMs !== null && uploadLoadedPingMs > 0
      ? Math.max(0, uploadLoadedPingMs - unloadedPingMs)
      : null;

  const maxBarMs = Math.max(
    40,
    unloadedPingMs ?? 0,
    loadedPingMs ?? 0,
    downloadLoadedPingMs ?? 0,
    uploadLoadedPingMs ?? 0,
  );

  const liveStatusLabel =
    phase === 'ping'
      ? 'Measuring idle latency baseline...'
      : phase === 'download'
        ? 'Measuring latency inflation under download load...'
        : phase === 'upload'
          ? 'Measuring latency inflation under upload load...'
          : bloat
            ? bloat.summary
            : 'Run a speed test to compare idle ping against download and upload load latency.';

  return (
    <section
      aria-label="Bufferbloat analysis"
      className="overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] vx-card transition-colors duration-200"
    >
      {/* Header Row: Title, Live Status & Grade Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] px-6 py-5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Gauge
            className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-50">
                Bufferbloat Analysis
              </h3>
              <span className="text-xs text-stone-400 dark:text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
                Idle vs. Loaded Latency
              </span>
              {isTesting && (phase === 'ping' || phase === 'download' || phase === 'upload') && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] dark:text-[#38BDF8]">
                  <Activity className="h-3 w-3 animate-pulse" aria-hidden="true" />
                  <span>Live</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
              {liveStatusLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {bloat && unloadedPingMs !== null && loadedPingMs !== null ? (
            <>
              <div className="text-right font-mono text-xs tabular-nums text-stone-500 dark:text-slate-400">
                <div>
                  Idle{' '}
                  <strong className="text-stone-900 dark:text-slate-100">
                    {unloadedPingMs.toFixed(1)} ms
                  </strong>{' '}
                  → Loaded{' '}
                  <strong className="text-stone-900 dark:text-slate-100">
                    {loadedPingMs.toFixed(1)} ms
                  </strong>
                </div>
                <div className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                  Inflation{' '}
                  <span className="font-semibold text-stone-800 dark:text-slate-200">
                    +{bloat.deltaMs.toFixed(1)} ms
                  </span>{' '}
                  · {bloat.label}
                </div>
              </div>

              <motion.div
                key={bloat.grade}
                initial={{scale: 0.9, opacity: 0}}
                animate={{scale: 1, opacity: 1}}
                transition={{type: 'spring', stiffness: 360, damping: 24}}
                aria-label={`Bufferbloat grade ${bloat.grade}`}
                className={`flex h-12 min-w-[52px] items-center justify-center rounded-lg border px-3.5 font-mono text-xl font-bold tabular-nums ${getGradeCardClasses(bloat.grade)}`}
              >
                {bloat.grade}
              </motion.div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {hasIdle && (
                <div className="text-right font-mono text-xs tabular-nums text-stone-500 dark:text-slate-400">
                  Idle{' '}
                  <strong className="text-stone-900 dark:text-slate-100">
                    {unloadedPingMs!.toFixed(1)} ms
                  </strong>
                </div>
              )}
              <div className="flex h-12 min-w-[52px] items-center justify-center rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31] px-3.5 font-mono text-sm font-semibold text-stone-400 dark:text-slate-500">
                --
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Latency Comparison & Grade Scale Body */}
      <div className="grid grid-cols-1 gap-6 bg-[#F8F7F4] dark:bg-[#0A101D] px-6 py-5 lg:grid-cols-12">
        {/* Left: Idle vs Download Load vs Upload Load Bars */}
        <div className="space-y-3 lg:col-span-7">
          {/* Idle Baseline */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-stone-700 dark:text-slate-200">
                Idle Baseline Ping
              </span>
              <span className="font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                {hasIdle ? `${unloadedPingMs!.toFixed(1)} ms` : '--'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAE6DD] dark:bg-[#1E2942]">
              <motion.div
                className="h-full origin-left bg-stone-500 dark:bg-slate-400"
                initial={{scaleX: 0}}
                animate={{
                  scaleX: hasIdle
                    ? Math.min(1, Math.max(0.05, unloadedPingMs! / maxBarMs))
                    : 0,
                }}
                transition={{type: 'spring', stiffness: 240, damping: 28}}
              />
            </div>
          </div>

          {/* Download Loaded */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-slate-200">
                <ArrowDown
                  className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8]"
                  aria-hidden="true"
                />
                <span>Under Download Load</span>
              </span>
              <span className="font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                {downloadLoadedPingMs !== null && downloadLoadedPingMs > 0 ? (
                  <>
                    {downloadLoadedPingMs.toFixed(1)} ms
                    {dlDeltaMs !== null && (
                      <span className="ml-1.5 text-[11px] font-normal text-stone-500 dark:text-slate-400">
                        (+{dlDeltaMs.toFixed(1)} ms)
                      </span>
                    )}
                  </>
                ) : hasLoaded ? (
                  `${loadedPingMs!.toFixed(1)} ms`
                ) : (
                  '--'
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAE6DD] dark:bg-[#1E2942]">
              <motion.div
                className="h-full origin-left bg-[#1D4ED8] dark:bg-[#38BDF8]"
                initial={{scaleX: 0}}
                animate={{
                  scaleX:
                    downloadLoadedPingMs !== null && downloadLoadedPingMs > 0
                      ? Math.min(1, Math.max(0.05, downloadLoadedPingMs / maxBarMs))
                      : hasLoaded
                        ? Math.min(1, Math.max(0.05, loadedPingMs! / maxBarMs))
                        : 0,
                }}
                transition={{type: 'spring', stiffness: 240, damping: 28}}
              />
            </div>
          </div>

          {/* Upload Loaded */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-slate-200">
                <ArrowUp
                  className="h-3.5 w-3.5 text-[#65A30D] dark:text-[#A3E635]"
                  aria-hidden="true"
                />
                <span>Under Upload Load</span>
              </span>
              <span className="font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                {uploadLoadedPingMs !== null && uploadLoadedPingMs > 0 ? (
                  <>
                    {uploadLoadedPingMs.toFixed(1)} ms
                    {ulDeltaMs !== null && (
                      <span className="ml-1.5 text-[11px] font-normal text-stone-500 dark:text-slate-400">
                        (+{ulDeltaMs.toFixed(1)} ms)
                      </span>
                    )}
                  </>
                ) : (
                  '--'
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAE6DD] dark:bg-[#1E2942]">
              <motion.div
                className="h-full origin-left bg-[#65A30D] dark:bg-[#A3E635]"
                initial={{scaleX: 0}}
                animate={{
                  scaleX:
                    uploadLoadedPingMs !== null && uploadLoadedPingMs > 0
                      ? Math.min(1, Math.max(0.05, uploadLoadedPingMs / maxBarMs))
                      : 0,
                }}
                transition={{type: 'spring', stiffness: 240, damping: 28}}
              />
            </div>
          </div>
        </div>

        {/* Right: A+ to F Grade Scale + Router SQM Guidance */}
        <div className="flex flex-col justify-between gap-3 lg:col-span-5">
          <div>
            <div className="text-xs font-medium text-stone-500 dark:text-slate-400 mb-2">
              Bufferbloat Grade Scale (Added Latency)
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {GRADE_TIERS.map((tier) => {
                const active = bloat?.grade === tier.grade;
                return (
                  <div
                    key={tier.grade}
                    className={`rounded-md border px-1.5 py-2 text-center transition-colors ${
                      active
                        ? getTierHighlightClasses(tier.grade)
                        : 'border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] text-stone-500 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold">{tier.grade}</div>
                    <div className="mt-0.5 font-mono text-[10px] opacity-85 tabular-nums whitespace-nowrap">
                      {tier.threshold}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-2.5 text-xs text-stone-600 dark:text-slate-300">
            {bloat && (bloat.grade === 'C' || bloat.grade === 'D' || bloat.grade === 'F') ? (
              <>
                <Wrench
                  className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  Enable Smart Queue Management (SQM / CAKE / fq_codel) on your router and cap uplink/downlink shaping around 90–95% of max speed to eliminate queue lag.
                </span>
              </>
            ) : (
              <>
                <ShieldCheck
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {bloat
                    ? 'Router queue stays responsive under concurrent traffic — voice calls and gaming packets avoid buffering stalls.'
                    : 'Grades compare unloaded baseline ping against median latency measured during active download and upload bursts.'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
