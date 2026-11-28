import React, {useState} from 'react';
import {Check, Chrome, Download, Laptop, Smartphone, X} from 'lucide-react';
import {BottomSheetModal} from './BottomSheetModal';

interface InstallExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallPWA: () => Promise<boolean>;
  ispName: string;
}

export const InstallExtensionModal: React.FC<InstallExtensionModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  onInstallPWA,
  ispName,
}) => {
  const [previewPhase, setPreviewPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [previewPing, setPreviewPing] = useState<string>('--');
  const [previewDl, setPreviewDl] = useState<string>('0.0');
  const [previewUl, setPreviewUl] = useState<string>('--');
  const [previewScore, setPreviewScore] = useState<string>('--');

  const runExtensionPreview = async () => {
    setPreviewPhase('running');
    try {
      const p0 = performance.now();
      await fetch(`/api/speedtest/ping?ext_preview=1&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const ping = Math.max(1, performance.now() - p0);
      setPreviewPing(`${Math.round(ping)} ms`);

      const d0 = performance.now();
      const res = await fetch(
        `/api/speedtest/download?bytes=${2 * 1024 * 1024}&t=${Date.now()}`,
        {cache: 'no-store'},
      );
      const buf = await res.arrayBuffer();
      const dSec = Math.max(0.03, (performance.now() - d0) / 1000);
      const dl = (buf.byteLength * 8) / (dSec * 1e6);
      setPreviewDl(dl.toFixed(1));

      const ulBytes = new Uint8Array(1024 * 1024);
      const u0 = performance.now();
      await fetch('/api/speedtest/upload', {
        method: 'POST',
        headers: {'Content-Type': 'application/octet-stream'},
        body: ulBytes,
      });
      const uSec = Math.max(0.03, (performance.now() - u0) / 1000);
      const ul = (ulBytes.byteLength * 8) / (uSec * 1e6);
      setPreviewUl(`${ul.toFixed(1)} Mbps`);

      const score = Math.min(
        100,
        Math.round(
          Math.min(50, dl / 4) +
            Math.min(25, ul / 2) +
            Math.max(0, 25 - ping / 4),
        ),
      );
      setPreviewScore(`${score} / 100`);
      setPreviewPhase('done');
    } catch {
      setPreviewPhase('idle');
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="dist-modal-title"
      maxWidthClass="max-w-3xl"
    >
      <div className="px-6 pt-2 pb-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#EAE6DD] dark:border-[#1E2942] pb-4">
          <div>
            <h2 id="dist-modal-title" className="text-lg font-bold text-stone-900 dark:text-slate-50">
              Install Veloxis as an App or Chrome Extension
            </h2>
            <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
              Run Veloxis from your desktop dock, mobile home screen, or Google Chrome toolbar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 dark:text-slate-500 hover:bg-[#EAE6DD] dark:hover:bg-[#131C31] hover:text-stone-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-slate-50">
                <Laptop className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
                <span>Install Desktop &amp; Mobile App (PWA)</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                Launches in its own standalone window with cached UI shell and instant speed-test access.
              </p>

              <div className="mt-4">
                {isInstalled ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Veloxis is installed as a standalone app</span>
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={onInstallPWA}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Install Veloxis App</span>
                  </button>
                ) : isIOS ? (
                  <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] p-3 text-xs text-stone-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-slate-100">
                      <Smartphone className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8]" />
                      <span>Install on iPhone / iPad Safari</span>
                    </div>
                    <ol className="mt-1.5 list-decimal pl-4 space-y-1">
                      <li>Tap the Share icon in the Safari toolbar.</li>
                      <li>Scroll down and tap Add to Home Screen.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] p-3 text-xs text-stone-600 dark:text-slate-300">
                    Click the Install icon in your browser address bar (Chrome / Edge) to add Veloxis as a desktop app.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-slate-50">
                <Chrome className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
                <span>Add to Chrome (Manifest V3 Extension)</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                Download the complete Manifest V3 extension package pre-configured for this Veloxis telemetry node.
              </p>

              <a
                href="/api/extension/download"
                download="veloxis-chrome-extension.zip"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-stone-900 dark:bg-[#131C31] px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-[#1E2942] transition-colors"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download Chrome Extension (.zip)</span>
              </a>

              <ol className="mt-3.5 space-y-1.5 text-xs text-stone-600 dark:text-slate-300 list-decimal pl-4">
                <li>Unzip <span className="font-mono text-stone-800 dark:text-slate-100">veloxis-chrome-extension.zip</span>.</li>
                <li>
                  Open <span className="font-mono text-stone-800 dark:text-slate-100">chrome://extensions</span> and enable Developer mode.
                </li>
                <li>Click Load unpacked and select the unzipped folder.</li>
              </ol>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31]/70 p-4">
            <div className="mb-2 text-[11px] font-medium text-stone-500 dark:text-slate-400">
              Interactive Chrome Toolbar Popup Preview
            </div>

            <div className="relative w-full max-w-[320px] overflow-hidden rounded-xl bg-[#F3F1EC] dark:bg-[#060913] vx-card-elevated">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-white/25 to-transparent"
              />
              <div className="flex items-center justify-between border-b border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-4 py-2.5">
                <span className="text-sm font-bold text-stone-900 dark:text-slate-50">Veloxis</span>
                <span className="max-w-[160px] truncate text-[11px] text-stone-500 dark:text-slate-400">
                  {ispName}
                </span>
              </div>

              <div className="p-4">
                <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] p-3.5 text-center">
                  <div className="text-[11px] text-stone-500 dark:text-slate-400">
                    {previewPhase === 'running'
                      ? 'Measuring...'
                      : previewPhase === 'done'
                        ? 'Quick Test Complete'
                        : 'Toolbar Quick Test'}
                  </div>
                  <div className="mt-1 flex items-baseline justify-center gap-1">
                    <span className="font-mono text-3xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                      {previewDl}
                    </span>
                    <span className="font-mono text-xs font-semibold text-stone-400 dark:text-slate-500">
                      Mbps
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-2">
                    <div className="text-[10px] text-stone-500 dark:text-slate-400">Ping</div>
                    <div className="font-mono text-xs font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                      {previewPing}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-2">
                    <div className="text-[10px] text-stone-500 dark:text-slate-400">Upload</div>
                    <div className="font-mono text-xs font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                      {previewUl}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-2">
                    <span className="text-[10px] text-stone-500 dark:text-slate-400">Veloxis Score</span>
                    <span className="font-mono text-xs font-semibold text-[#1D4ED8] dark:text-[#38BDF8] tabular-nums">
                      {previewScore}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={previewPhase === 'running'}
                  onClick={runExtensionPreview}
                  className="mt-3 w-full rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary disabled:opacity-60 cursor-pointer"
                >
                  {previewPhase === 'running' ? 'Testing...' : 'Test Popup Speed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
