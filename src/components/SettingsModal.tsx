import React from 'react';
import {
  Chrome,
  Download,
  MapPin,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import {motion} from 'motion/react';
import type {CalibrationStatus} from '../hooks/useCalibrationPermissions';
import type {ThemePreference} from '../hooks/useSystemTheme';
import {BottomSheetModal} from './BottomSheetModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: (next: boolean) => void;
  installPromptHiddenPermanently: boolean;
  onReEnableInstallPrompts: () => void;
  onOpenInstallModal: () => void;
  calibrationStatus: CalibrationStatus;
  onOpenPermissionsSheet: () => void;
  onResetCalibration: () => void;
  onResetAdConsent: () => void;
  themePreference: ThemePreference;
  onChangeThemePreference: (next: ThemePreference) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  showAdvanced,
  onToggleAdvanced,
  installPromptHiddenPermanently,
  onReEnableInstallPrompts,
  onOpenInstallModal,
  calibrationStatus,
  onOpenPermissionsSheet,
  onResetCalibration,
  onResetAdConsent,
  themePreference,
  onChangeThemePreference,
}) => {
  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="settings-modal-title"
      maxWidthClass="max-w-lg"
    >
      <div className="px-6 pt-2 pb-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
          <div className="flex items-center gap-2.5">
            <Settings2
              className="h-5 w-5 text-[#1D4ED8] dark:text-[#38BDF8]"
              aria-hidden="true"
            />
            <h2
              id="settings-modal-title"
              className="text-base font-bold text-stone-900 dark:text-slate-50"
            >
              Settings &amp; Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] hover:text-stone-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-xs">
          {/* Distinct Light & Dark Color Palettes */}
          <div className="space-y-2.5 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
            <div className="font-semibold text-stone-900 dark:text-slate-100">
              Color Palette Mode
            </div>
            <p className="text-stone-500 dark:text-slate-400">
              Daylight uses warm mineral paper &amp; cobalt; Obsidian uses deep midnight indigo &amp; electric cyan.
            </p>
            <div
              role="group"
              aria-label="Color palette mode"
              className="grid grid-cols-3 gap-1 rounded-lg bg-[#EAE6DD]/75 dark:bg-[#131C31]/75 p-0.5 vx-pill-tray"
            >
              {(
                [
                  {id: 'system', label: 'System Auto', Icon: Monitor},
                  {id: 'light', label: 'Daylight', Icon: Sun},
                  {id: 'dark', label: 'Obsidian', Icon: Moon},
                ] as const
              ).map(({id, label, Icon}) => {
                const active = themePreference === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChangeThemePreference(id)}
                    aria-pressed={active}
                    className={`relative flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'text-stone-900 dark:text-slate-50'
                        : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-theme-pill"
                        transition={{type: 'spring', stiffness: 460, damping: 34}}
                        className="absolute inset-0 rounded-md vx-pill-active"
                      />
                    )}
                    <Icon
                      className={`relative z-10 h-3.5 w-3.5 ${
                        active ? 'text-[#1D4ED8] dark:text-[#38BDF8]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div className="flex items-start justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
            <div className="flex items-start gap-2.5">
              <Sliders
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold text-stone-900 dark:text-slate-100">
                  Advanced Tests &amp; Network Diagnostics
                </div>
                <p className="mt-1 leading-relaxed text-stone-500 dark:text-slate-400">
                  Reveal Plan File Test, Live Monitor, Edge Server Selector, DNS Benchmarks, Router Topology, Reliability Watch, and Trends.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showAdvanced}
              onClick={() => onToggleAdvanced(!showAdvanced)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                showAdvanced
                  ? 'bg-[#1D4ED8] dark:bg-[#0EA5E9]'
                  : 'bg-[#DFDAD0] dark:bg-[#1E2942]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAdvanced ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* App & Extension Distribution */}
          <div className="space-y-3 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
            <div className="flex items-start gap-2.5">
              <Chrome
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="font-semibold text-stone-900 dark:text-slate-100">
                  App &amp; Chrome Extension
                </div>
                <p className="mt-1 leading-relaxed text-stone-500 dark:text-slate-400">
                  {installPromptHiddenPermanently
                    ? 'Post-test install prompts are permanently hidden. You can re-enable them or open the installer here anytime.'
                    : 'Veloxis prompts once after a completed test if not dismissed.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-6">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInstallModal();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31] px-3 py-1.5 font-semibold text-stone-800 dark:text-slate-100 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
                <span>Open App &amp; Extension Installer</span>
              </button>

              {installPromptHiddenPermanently && (
                <button
                  type="button"
                  onClick={onReEnableInstallPrompts}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] px-3 py-1.5 font-medium text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Re-enable Post-Test Prompt</span>
                </button>
              )}
            </div>
          </div>

          {/* Location & Device Calibration */}
          <div className="flex items-center justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
            <div className="flex items-start gap-2.5">
              <MapPin
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold text-stone-900 dark:text-slate-100">
                  Location &amp; Device Permissions
                </div>
                <p className="mt-0.5 text-stone-500 dark:text-slate-400">
                  Status:{' '}
                  <span className="font-medium text-stone-800 dark:text-slate-200">
                    {calibrationStatus === 'granted'
                      ? 'Active'
                      : calibrationStatus === 'denied'
                        ? 'Browser denied'
                        : 'Not enabled'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {calibrationStatus === 'granted' && (
                <button
                  type="button"
                  onClick={onResetCalibration}
                  className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] px-3 py-1.5 font-medium text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] cursor-pointer"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPermissionsSheet();
                }}
                className="rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-3 py-1.5 font-semibold text-white dark:text-slate-950 vx-btn-primary cursor-pointer"
              >
                {calibrationStatus === 'granted' ? 'Manage' : 'Review'}
              </button>
            </div>
          </div>

          {/* Ad Consent */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold text-stone-900 dark:text-slate-100">
                  Ad Consent Preferences
                </div>
                <p className="mt-0.5 text-stone-500 dark:text-slate-400">
                  Ads only display if active and never run during tests.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onResetAdConsent();
                onClose();
              }}
              className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] px-3 py-1.5 font-medium text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] cursor-pointer shrink-0"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
