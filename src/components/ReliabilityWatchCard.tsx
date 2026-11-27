import React from 'react';
import {AlertTriangle, Bell, BellOff, Clock3} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {SpeedUnit} from '../types/speedtest';
import {convertSpeed, formatDuration} from '../utils/scoring';

interface ReliabilityWatchCardProps {
  intervalMin: number; // 0 = off
  thresholdPct: number; // % of subscribed download speed, or fallback target
  subscribedDownloadMbps: number | null;
  speedUnit: SpeedUnit;
  countdownSec: number | null;
  runsCount: number;
  alertsCount: number;
  lastAlertMessage: string | null;
  notificationsEnabled: boolean;
  onChangeInterval: (minutes: number) => void;
  onChangeThresholdPct: (pct: number) => void;
  onToggleNotifications: () => void;
  onDismissAlert: () => void;
}

const INTERVAL_OPTIONS = [
  {value: 0, label: 'Off'},
  {value: 5, label: 'Every 5 min'},
  {value: 15, label: 'Every 15 min'},
  {value: 30, label: 'Every 30 min'},
  {value: 60, label: 'Every 60 min'},
];

const THRESHOLD_OPTIONS = [50, 70, 80, 90];

export const ReliabilityWatchCard: React.FC<ReliabilityWatchCardProps> = ({
  intervalMin,
  thresholdPct,
  subscribedDownloadMbps,
  speedUnit,
  countdownSec,
  runsCount,
  alertsCount,
  lastAlertMessage,
  notificationsEnabled,
  onChangeInterval,
  onChangeThresholdPct,
  onToggleNotifications,
  onDismissAlert,
}) => {
  const isActive = intervalMin > 0;
  const thresholdMbps =
    subscribedDownloadMbps && subscribedDownloadMbps > 0
      ? (subscribedDownloadMbps * thresholdPct) / 100
      : null;

  return (
    <section
      aria-label="Scheduled reliability watch"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-6 py-5 sm:px-8 transition-colors duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Clock3
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Scheduled Reliability Watch
              </h2>
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
                  {countdownSec !== null
                    ? `Next run in ${formatDuration(countdownSec, false)}`
                    : 'Armed'}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isActive
                ? `Automatically runs Quick Tests every ${intervalMin} min while this tab stays open (${runsCount} checks · ${alertsCount} alerts).`
                : 'Run automatic periodic checks while this tab or app is open to catch ISP throttling and drops.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Reliability watch interval"
            value={intervalMin}
            onChange={(e) => onChangeInterval(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Schedule: {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Minimum speed alert threshold"
            value={thresholdPct}
            onChange={(e) => onChangeThresholdPct(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            {THRESHOLD_OPTIONS.map((pct) => (
              <option key={pct} value={pct}>
                Alert &lt; {pct}% of plan
                {subscribedDownloadMbps
                  ? ` (${Number(convertSpeed((subscribedDownloadMbps * pct) / 100, speedUnit).toFixed(1))} ${speedUnit})`
                  : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleNotifications}
            aria-pressed={notificationsEnabled}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              notificationsEnabled
                ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {notificationsEnabled ? (
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{notificationsEnabled ? 'Alerts On' : 'Desktop Alerts'}</span>
          </button>
        </div>
      </div>

      {isActive && thresholdMbps === null && (
        <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          Set your subscribed ISP plan speed below to enable automatic under-delivery alerts during scheduled runs.
        </p>
      )}

      <AnimatePresence>
        {lastAlertMessage && (
          <motion.div
            initial={{opacity: 0, y: -4}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -4}}
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{lastAlertMessage}</span>
            </span>
            <button
              type="button"
              onClick={onDismissAlert}
              className="text-[11px] font-semibold underline cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
