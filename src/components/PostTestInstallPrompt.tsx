import React from 'react';
import {Chrome, Download, Smartphone, X} from 'lucide-react';
import {BottomSheetModal} from './BottomSheetModal';

interface PostTestInstallPromptProps {
  isOpen: boolean;
  isMobileBrowser: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  onInstallPWA: () => Promise<boolean>;
  onDismissSession: () => void;
  onHidePermanently: () => void;
}

export const PostTestInstallPrompt: React.FC<PostTestInstallPromptProps> = ({
  isOpen,
  isMobileBrowser,
  isInstallable,
  isIOS,
  onInstallPWA,
  onDismissSession,
  onHidePermanently,
}) => {
  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onDismissSession}
      ariaLabelledBy="post-install-title"
      maxWidthClass="max-w-md"
    >
      <div className="px-6 pt-2 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isMobileBrowser ? (
              <Smartphone
                className="h-5 w-5 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Chrome
                className="h-5 w-5 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0"
                aria-hidden="true"
              />
            )}
            <h2
              id="post-install-title"
              className="text-base font-bold text-stone-900 dark:text-slate-50"
            >
              {isMobileBrowser
                ? 'Install Veloxis as an App'
                : 'Add Veloxis to Chrome'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onDismissSession}
            aria-label="Close prompt for this session"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] hover:text-stone-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isMobileBrowser ? (
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            <p>
              Add Veloxis to your home screen for one-tap speed checks and instant offline test history.
            </p>

            {isInstallable ? (
              <button
                type="button"
                onClick={async () => {
                  const accepted = await onInstallPWA();
                  if (!accepted) {
                    onDismissSession();
                  }
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Install App</span>
              </button>
            ) : isIOS ? (
              <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31] p-3">
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Tap the Share button in Safari.</li>
                  <li>Select Add to Home Screen.</li>
                </ol>
              </div>
            ) : (
              <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31] p-3">
                Open your browser menu and tap Install app or Add to Home screen.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            <p>
              Run quick speed checks right from your Chrome toolbar with the lightweight Manifest V3 extension.
            </p>

            <a
              href="/api/extension/download"
              download="veloxis-chrome-extension.zip"
              onClick={onDismissSession}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Add to Chrome (.zip)</span>
            </a>

            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              Unzip, open <span className="font-mono">chrome://extensions</span>, enable Developer mode, and click Load unpacked.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EAE6DD] dark:border-[#1E2942] pt-3">
          <button
            type="button"
            onClick={onHidePermanently}
            className="text-[11px] font-medium text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Don&apos;t show again
          </button>
          <button
            type="button"
            onClick={onDismissSession}
            className="rounded-lg bg-white dark:bg-[#131C31] px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary cursor-pointer"
          >
            Not now
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
