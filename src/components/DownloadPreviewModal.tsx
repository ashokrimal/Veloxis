import React from 'react';
import {Download, X} from 'lucide-react';
import {BottomSheetModal} from './BottomSheetModal';

interface DownloadPreviewModalProps {
  isOpen: boolean;
  previewDataUrl: string | null;
  filename: string;
  onConfirmDownload: () => void;
  onClose: () => void;
}

export const DownloadPreviewModal: React.FC<DownloadPreviewModalProps> = ({
  isOpen,
  previewDataUrl,
  filename,
  onConfirmDownload,
  onClose,
}) => {
  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="download-preview-title"
      ariaDescribedBy="download-preview-description"
      maxWidthClass="max-w-2xl"
    >
      <div className="px-5 pt-2 pb-6 sm:px-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#DFDAD0] dark:border-[#1E2942] pb-4">
          <div>
            <h2
              id="download-preview-title"
              className="text-base font-bold tracking-tight text-stone-900 dark:text-slate-50"
            >
              Preview Snapshot Before Download
            </h2>
            <p
              id="download-preview-description"
              className="mt-1 text-xs text-stone-500 dark:text-slate-400"
            >
              Review your speed gauge, progress circles, and latency metrics before saving{' '}
              <span className="font-mono font-medium text-stone-700 dark:text-slate-300">
                {filename}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-[#EAE6DD]/60 hover:text-stone-700 dark:text-slate-500 dark:hover:bg-[#131C31] dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[#DFDAD0] dark:border-white/10 bg-[#FAF9F6] dark:bg-[#070B14] p-2 sm:p-3">
          {previewDataUrl ? (
            <img
              src={previewDataUrl}
              alt="Speed test snapshot preview showing main circle, three status circles, ping, jitter, and packet loss"
              className="block w-full h-auto rounded-lg"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-stone-500 dark:text-slate-400">
              Generating preview...
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white dark:bg-[#131C31] px-4 py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1E2942] vx-btn-secondary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewDataUrl}
            onClick={onConfirmDownload}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Confirm &amp; Download PNG</span>
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
