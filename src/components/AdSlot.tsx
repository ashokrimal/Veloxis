import React, {useEffect, useState} from 'react';
import {ExternalLink, Info} from 'lucide-react';

interface AdSlotProps {
  placement: 'post-test-card' | 'footer-banner';
  isTesting: boolean;
  measuredDownloadMbps?: number;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export const AdSlot: React.FC<AdSlotProps> = ({
  placement,
  isTesting,
  measuredDownloadMbps = 0,
}) => {
  const [showTransparency, setShowTransparency] = useState(false);

  const clientId =
    (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) ||
    'ca-pub-1138327552755079';
  const slotId =
    placement === 'footer-banner'
      ? (import.meta.env.VITE_ADSENSE_FOOTER_SLOT as string | undefined)
      : (import.meta.env.VITE_ADSENSE_CARD_SLOT as string | undefined);

  const hasLiveAdSense = Boolean(clientId && slotId);

  useEffect(() => {
    if (!hasLiveAdSense || isTesting) return;

    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    );
    if (!existingScript && clientId) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script still loading or blocked by user extension
    }
  }, [hasLiveAdSense, isTesting, clientId, slotId]);

  if (placement === 'post-test-card') {
    const isSlowResult = measuredDownloadMbps > 0 && measuredDownloadMbps < 100;

    return (
      <aside
        aria-label="Sponsored post-test recommendation"
        className="min-h-[112px] rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Sponsored · Zero-Disruption Placement</span>
          <button
            type="button"
            onClick={() => setShowTransparency((v) => !v)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <Info className="h-3 w-3" aria-hidden="true" />
            <span>Ad Policy</span>
          </button>
        </div>

        {showTransparency && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600">
            Veloxis pauses ad requests while speed measurements are active so third-party scripts never consume your bandwidth or skew latency results.
          </p>
        )}

        {hasLiveAdSense && !isTesting ? (
          <div className="mt-2 min-h-[72px]">
            <ins
              className="adsbygoogle block"
              style={{display: 'block'}}
              data-ad-client={clientId}
              data-ad-slot={slotId}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        ) : (
          <div className="mt-2.5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                {isSlowResult
                  ? 'Compare Fiber ISPs & Wi-Fi 7 Mesh Upgrades'
                  : 'Protect High-Speed Connections with Audited DNS & Router Security'}
              </h4>
              <p className="mt-0.5 text-xs text-slate-600">
                {isSlowResult
                  ? 'See symmetrical gigabit plans and low-latency routers available near your area.'
                  : 'AdSense publisher connected — add VITE_ADSENSE_CARD_SLOT to bind a specific display unit.'}
              </p>
            </div>
            <a
              href="#benchmark"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Compare Plans</span>
              <ExternalLink className="h-3 w-3 text-slate-500" aria-hidden="true" />
            </a>
          </div>
        )}
      </aside>
    );
  }

  // Subtle Footer Banner
  return (
    <div
      aria-label="Sponsored footer placement"
      className="mx-auto w-full max-w-[728px] min-h-[68px] sm:min-h-[90px] rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-col justify-center"
    >
      {hasLiveAdSense && !isTesting ? (
        <ins
          className="adsbygoogle block"
          style={{display: 'block'}}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-slate-400">
              Sponsored
            </span>
            <span className="text-xs font-medium text-slate-700">
              Upgrade home routing with multi-gigabit Wi-Fi 7 hardware or compare regional fiber offers
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            728×90 AdSense-Ready Slot
          </span>
        </div>
      )}
    </div>
  );
};
