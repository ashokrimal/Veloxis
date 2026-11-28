import React, {useState} from 'react';
import {AlertTriangle, X} from 'lucide-react';
import type {BenchmarkProfile, SpeedUnit} from '../types/speedtest';
import {
  computeSubscriptionTransferBytes,
  convertSpeed,
  formatTransferSize,
} from '../utils/scoring';
import {BottomSheetModal} from './BottomSheetModal';

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
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      role="alertdialog"
      ariaLabelledBy="transfer-alert-title"
      ariaDescribedBy="transfer-alert-desc"
      maxWidthClass="max-w-lg"
    >
      <div>
        <div className="flex items-start justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] px-6 pt-2 pb-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
            <h2
              id="transfer-alert-title"
              className="text-base font-semibold text-stone-900 dark:text-slate-50"
            >
              Confirm Subscription File Transfer Test
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alert"
            className="rounded-md p-1 text-stone-400 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] hover:text-stone-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          <p
            id="transfer-alert-desc"
            className="leading-relaxed text-stone-600 dark:text-slate-300"
          >
            This test measures your real-world sustained throughput by transferring actual file payloads sized to your ISP plan. It will{' '}
            <span className="font-semibold text-stone-900 dark:text-slate-100">
              download {formatTransferSize(effectiveDlBytes)}
            </span>{' '}
            and{' '}
            <span className="font-semibold text-stone-900 dark:text-slate-100">
              upload {formatTransferSize(effectiveUlBytes)}
            </span>{' '}
            ({formatTransferSize(totalBytes)} total data). Avoid running this on metered or limited mobile data plans.
          </p>

          <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-stone-700 dark:text-slate-200">
                ISP Plan Tier ({speedUnit})
              </span>
              <span className="font-mono text-stone-500 dark:text-slate-400 tabular-nums">
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
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'vx-pill-active text-[#1D4ED8] dark:text-[#38BDF8] font-semibold'
                        : 'bg-white dark:bg-[#0D1322] text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary'
                    }`}
                  >
                    {tierLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/60 p-3.5">
            <div>
              <div className="text-[11px] text-stone-500 dark:text-slate-400">
                Download Size
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                {formatTransferSize(effectiveDlBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-stone-400 dark:text-slate-500">
                {dlEst}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500 dark:text-slate-400">
                Upload Size
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                {formatTransferSize(effectiveUlBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-stone-400 dark:text-slate-500">
                {ulEst}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500 dark:text-slate-400">
                Total Data Used
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatTransferSize(totalBytes)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-stone-400 dark:text-slate-500">
                {totalEstLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
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
                    className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'vx-pill-active text-stone-900 dark:text-slate-50 font-semibold'
                        : 'bg-white dark:bg-[#0D1322] text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/70 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToQuickTest();
            }}
            className="text-xs font-medium text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-slate-100 underline underline-offset-4 cursor-pointer"
          >
            Use Quick Test (~11s) instead
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white dark:bg-[#0D1322] px-4 py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirmFileTest(effectiveDlBytes, effectiveUlBytes);
              }}
              className="rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary cursor-pointer"
            >
              Start ({formatTransferSize(totalBytes)})
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
