import React, {useState} from 'react';
import {AlertTriangle, X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {BenchmarkProfile, SpeedUnit} from '../types/speedtest';
import {
  computeSubscriptionTransferBytes,
  convertSpeed,
  formatTransferSize,
} from '../utils/scoring';

interface TransferAlertModalProps {
  isOpen: boolean;
  profile: BenchmarkProfile;
  speedUnit: SpeedUnit;
  onChangeProfile: (next: BenchmarkProfile) => void;
  onClose: () => void;
  onConfirmFileTest: (downloadBytes: number, uploadBytes: number) => void;
  onSwitchToQuickTest: () => void;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

const QUICK_TIERS_MBPS = [30, 50, 100, 200, 500, 1000];
const SIZE_PRESETS = [
  {label: '250 MB', bytes: 250 * MB},
  {label: '500 MB', bytes: 500 * MB},
  {label: '1 GB', bytes: 1 * GB},
  {label: '2 GB', bytes: 2 * GB},
];

function formatDurationEstimate(bytes: number, speedMbps: number | null): string {
  if (!speedMbps || speedMbps <= 0) return 'Depends on your connection speed';
  const bytesPerSec = (speedMbps * 1_000_000) / 8;
  const totalSec = Math.max(1, Math.round(bytes / bytesPerSec));
  if (totalSec < 60) return `~${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
}

export const TransferAlertModal: React.FC<TransferAlertModalProps> = ({
  isOpen,
  profile,
  speedUnit,
  onChangeProfile,
  onClose,
  onConfirmFileTest,
  onSwitchToQuickTest,
}) => {
  const [customDlBytes, setCustomDlBytes] = useState<number | null>(null);
  const [customUlBytes, setCustomUlBytes] = useState<number | null>(null);


  const dlPlanVal =
    profile.subscribedDownloadMbps !== null
      ? convertSpeed(profile.subscribedDownloadMbps, speedUnit)
      : null;
  const ulPlanVal =
    profile.subscribedUploadMbps !== null
      ? convertSpeed(profile.subscribedUploadMbps, speedUnit)
      : null;

  const recommendedDlBytes = computeSubscriptionTransferBytes(dlPlanVal);
  const recommendedUlBytes =
    ulPlanVal !== null
      ? computeSubscriptionTransferBytes(ulPlanVal)
      : recommendedDlBytes;

  const effectiveDlBytes = customDlBytes ?? recommendedDlBytes;
  const effectiveUlBytes = customUlBytes ?? recommendedUlBytes;
  const totalBytes = effectiveDlBytes + effectiveUlBytes;

  const dlEst = formatDurationEstimate(
    effectiveDlBytes,
    profile.subscribedDownloadMbps,
  );
  const ulEst = formatDurationEstimate(
    effectiveUlBytes,
    profile.subscribedUploadMbps ?? profile.subscribedDownloadMbps,
  );
  const totalEstSec =
    profile.subscribedDownloadMbps && profile.subscribedDownloadMbps > 0
      ? Math.max(
          2,
          Math.round(
            1.5 +
              effectiveDlBytes / ((profile.subscribedDownloadMbps * 1_000_000) / 8) +
              effectiveUlBytes /
                (((profile.subscribedUploadMbps ?? profile.subscribedDownloadMbps) *
                  1_000_000) /
                  8),
          ),
        )
      : null;
  const totalEstLabel =
    totalEstSec !== null
      ? totalEstSec < 60
        ? `~${totalEstSec}s total`
        : totalEstSec % 60 > 0
          ? `~${Math.floor(totalEstSec / 60)}m ${totalEstSec % 60}s total`
          : `~${Math.floor(totalEstSec / 60)}m total`
      : 'Both ways';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="transfer-alert-backdrop"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.18, ease: 'easeOut'}}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 p-4 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="transfer-alert-title"
          aria-describedby="transfer-alert-desc"
        >
          <motion.div
            initial={{opacity: 0, scale: 0.96, y: 10}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.97, y: 6}}
            transition={{type: 'spring', stiffness: 380, damping: 30}}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl"
          >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
            <h2
              id="transfer-alert-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-50"
            >
              Confirm Subscription File Transfer Test
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alert"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          <p
            id="transfer-alert-desc"
            className="leading-relaxed text-slate-600 dark:text-slate-300"
          >
            This test measures your real-world sustained throughput by transferring actual file payloads sized to your ISP plan. It will{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              download {formatTransferSize(effectiveDlBytes)}
            </span>{' '}
            and{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              upload {formatTransferSize(effectiveUlBytes)}
            </span>{' '}
            ({formatTransferSize(totalBytes)} total data). Avoid running this on metered or limited mobile data plans.
          </p>

          {/* Subscription Plan Picker if not set or to adjust quickly */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                ISP Plan Tier ({speedUnit})
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {profile.subscribedDownloadMbps !== null
                  ? `${Number(convertSpeed(profile.subscribedDownloadMbps, speedUnit).toFixed(1))} ${speedUnit}`
                  : 'Not set (defaulting to 500 MB)'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIERS_MBPS.map((tierMbps) => {
                const active = profile.subscribedDownloadMbps === tierMbps;
                const tierLabel =
                  speedUnit === 'MBps'
                    ? `${Number(convertSpeed(tierMbps, 'MBps').toFixed(1))} MBps`
                    : `${tierMbps} Mbps`;
                return (
                  <button
                    key={tierMbps}
                    type="button"
                    onClick={() => {
                      setCustomDlBytes(null);
                      setCustomUlBytes(null);
                      onChangeProfile({
                        ...profile,
                        planName: `${tierMbps} Mbps Plan`,
                        subscribedDownloadMbps: tierMbps,
                      });
                    }}
                    className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-600 dark:border-blue-500 bg-blue-600 dark:bg-blue-500 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tierLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transfer Size Breakdown & Preset Override */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Download Size
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                {formatTransferSize(effectiveDlBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {dlEst}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload Size
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                {formatTransferSize(effectiveUlBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {ulEst}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Total Data Used
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatTransferSize(totalBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {totalEstLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Override file size per direction:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_PRESETS.map((preset) => {
                const selected = effectiveDlBytes === preset.bytes && effectiveUlBytes === preset.bytes;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setCustomDlBytes(preset.bytes);
                      setCustomUlBytes(preset.bytes);
                    }}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'border-slate-900 dark:border-slate-200 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-6 py-3.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToQuickTest();
            }}
            className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4 cursor-pointer"
          >
            Use Quick Test (~11s) instead
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirmFileTest(effectiveDlBytes, effectiveUlBytes);
              }}
              className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-400 cursor-pointer"
            >
              Start ({formatTransferSize(totalBytes)})
            </button>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
