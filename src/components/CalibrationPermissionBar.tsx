import React, {useState} from 'react';
import {Check, Cpu, Lock, MapPin, RotateCcw, Shield, Wifi, X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {
  CalibrationStatus,
  CalibratedLocation,
} from '../hooks/useCalibrationPermissions';
import type {CalibrationDeviceInfo} from '../types/speedtest';
import {BottomSheetModal} from './BottomSheetModal';

interface CalibrationPermissionBarProps {
  status: CalibrationStatus;
  isRequesting: boolean;
  location: CalibratedLocation | null;
  device: CalibrationDeviceInfo | null;
  onAllow: () => Promise<void> | void;
  onDismiss: () => void;
  onReset: () => void;
  sheetOpen?: boolean;
  onOpenSheet?: () => void;
  onCloseSheet?: () => void;
}

export const CalibrationPermissionBar: React.FC<
  CalibrationPermissionBarProps
> = ({
  status,
  isRequesting,
  location,
  device,
  onAllow,
  onDismiss,
  onReset,
  sheetOpen,
  onOpenSheet,
  onCloseSheet,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isSheetOpen = sheetOpen ?? internalOpen;
  const openSheet = () => (onOpenSheet ? onOpenSheet() : setInternalOpen(true));
  const closeSheet = () => (onCloseSheet ? onCloseSheet() : setInternalOpen(false));

  const handleGrant = async () => {
    await onAllow();
    closeSheet();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {status === 'prompt' ? (
          <motion.div
            key="perm-prompt"
            initial={{opacity: 0, y: -6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -6}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#0D1322] px-4 py-3 text-xs vx-card transition-colors duration-200"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-stone-600 dark:text-slate-300 leading-relaxed">
                Allow optional{' '}
                <span className="font-semibold text-stone-900 dark:text-slate-100">
                  Location &amp; Device Calibration
                </span>{' '}
                to rank nearby servers, plot your approximate Test Location marker, and tune stream threads.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isRequesting}
                onClick={openSheet}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAE6DD]/70 dark:bg-[#131C31] px-3.5 py-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isRequesting ? 'Requesting...' : 'Review & Allow'}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Not now"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <span>Not now</span>
              </button>
            </div>
          </motion.div>
        ) : status === 'granted' ? (
          <motion.div
            key="perm-granted"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.18}}
            className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400 px-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openSheet}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                <span>Calibrated</span>
              </button>
              {location?.city && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {[location.city, location.country].filter(Boolean).join(', ')}
                  </span>
                </>
              )}
              {device && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <Cpu className="h-3 w-3 text-stone-400 dark:text-slate-500" aria-hidden="true" />
                    <span>
                      {device.cpuCores ? `${device.cpuCores} cores` : 'Auto CPU'}
                      {device.memoryGb ? ` · ${device.memoryGb} GB` : ''}
                      {` · ${device.recommendedStreams}x streams`}
                      {device.effectiveType
                        ? ` · ${device.effectiveType.toUpperCase()}`
                        : ''}
                    </span>
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openSheet}
                className="text-[11px] font-medium text-[#1D4ED8] dark:text-[#38BDF8] hover:underline cursor-pointer"
              >
                Permissions
              </button>
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset location and device calibration"
                className="inline-flex items-center gap-1 text-[11px] text-stone-400 dark:text-slate-500 hover:text-stone-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Permission Usage Modal Bottom Sheet */}
      <BottomSheetModal
        isOpen={isSheetOpen}
        onClose={closeSheet}
        ariaLabelledBy="permission-sheet-title"
        ariaDescribedBy="permission-sheet-desc"
        maxWidthClass="max-w-lg"
      >
        <div className="px-6 pt-2 pb-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
            <div className="flex items-start gap-2.5">
              <Shield
                className="h-5 w-5 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h2
                  id="permission-sheet-title"
                  className="text-base font-bold text-stone-900 dark:text-slate-50"
                >
                  Permission Usage &amp; Calibration
                </h2>
                <p
                  id="permission-sheet-desc"
                  className="mt-0.5 text-xs text-stone-500 dark:text-slate-400"
                >
                  Transparent breakdown of what Veloxis reads locally when calibrated.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close permission sheet"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] hover:text-stone-800 dark:hover:text-slate-100 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            {/* Geolocation Permission Card */}
            <div className="rounded-xl border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MapPin
                    className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-semibold text-stone-900 dark:text-slate-100">
                      Approximate Geolocation
                    </div>
                    <p className="mt-1 leading-relaxed text-stone-600 dark:text-slate-300">
                      Measures distance to edge nodes, matches local ISPs, and renders your ~2 km &ldquo;Test Location&rdquo; marker in the results summary.
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-[11px] font-semibold whitespace-nowrap ${
                    location
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-stone-400 dark:text-slate-500'
                  }`}
                >
                  {location ? 'Active' : status === 'denied' ? 'Blocked' : 'Optional'}
                </span>
              </div>
              {location && (
                <div className="mt-2.5 border-t border-[#DFDAD0]/70 dark:border-[#1E2942] pt-2 font-mono text-[11px] text-stone-500 dark:text-slate-400 tabular-nums">
                  {[location.city, location.region, location.country].filter(Boolean).join(', ') || 'Coordinates acquired'} · ~{location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
                </div>
              )}
            </div>

            {/* Hardware & Network Hint Card */}
            <div className="rounded-xl border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Cpu
                    className="h-4 w-4 text-[#65A30D] dark:text-[#A3E635] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-semibold text-stone-900 dark:text-slate-100">
                      Device Hardware &amp; Link Hints
                    </div>
                    <p className="mt-1 leading-relaxed text-stone-600 dark:text-slate-300">
                      Reads CPU thread count, browser RAM estimate, and effective link speed to pick optimal download/upload stream concurrency (2–4 streams).
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-[11px] font-semibold whitespace-nowrap ${
                    device
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-stone-400 dark:text-slate-500'
                  }`}
                >
                  {device ? 'Active' : 'Optional'}
                </span>
              </div>
              {device && (
                <div className="mt-2.5 border-t border-[#DFDAD0]/70 dark:border-[#1E2942] pt-2 font-mono text-[11px] text-stone-500 dark:text-slate-400 tabular-nums">
                  {device.cpuCores ? `${device.cpuCores} CPU threads` : 'Standard CPU'}
                  {device.memoryGb ? ` · ${device.memoryGb} GB RAM` : ''}
                  {` · ${device.recommendedStreams} parallel streams`}
                </div>
              )}
            </div>

            {/* Privacy Assurance */}
            <div className="flex items-start gap-2 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3.5 py-2.5 text-[11px] text-stone-500 dark:text-slate-400">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-stone-400 dark:text-slate-500" aria-hidden="true" />
              <span>
                Coordinates are rounded to ~2 km region precision on-device and never used for ad profiling. You can clear calibration anytime.
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE6DD] dark:border-[#1E2942] pt-4">
            {status === 'granted' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    closeSheet();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Revoke &amp; Reset</span>
                </button>
                <button
                  type="button"
                  disabled={isRequesting}
                  onClick={() => void handleGrant()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary cursor-pointer disabled:opacity-60"
                >
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isRequesting ? 'Refreshing...' : 'Re-Calibrate Now'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onDismiss();
                    closeSheet();
                  }}
                  className="rounded-lg bg-white dark:bg-[#131C31] px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary cursor-pointer"
                >
                  Not now
                </button>
                <button
                  type="button"
                  disabled={isRequesting}
                  onClick={() => void handleGrant()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary cursor-pointer disabled:opacity-60"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isRequesting ? 'Requesting...' : 'Allow & Calibrate'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </BottomSheetModal>
    </>
  );
};
