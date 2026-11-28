import React, {useEffect, useRef, useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {type AdConsentStatus, useAdConsent} from '../hooks/useAdConsent';

interface AdSlotProps {
  placement: 'post-test-card' | 'footer-banner';
  isTesting: boolean;
  measuredDownloadMbps?: number;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[] & {
      requestNonPersonalizedAds?: number;
      pauseAdRequests?: number;
    };
  }
}

const ADSENSE_CLIENT_ID = 'ca-pub-1138327552755079';

export const AdSlot: React.FC<AdSlotProps> = ({placement, isTesting}) => {
  const {consent, updateConsent} = useAdConsent();
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [isAdActive, setIsAdActive] = useState(false);

  const isConsented =
    consent.status === 'personalized' || consent.status === 'non_personalized';

  useEffect(() => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds =
      consent.status === 'non_personalized' ? 1 : 0;
    window.adsbygoogle.pauseAdRequests = isConsented && !isTesting ? 0 : 1;

    if (!isConsented || isTesting) {
      setIsAdActive(false);
      return;
    }

    const el = insRef.current;
    if (!el) return;

    const checkStatus = () => {
      const status = el.getAttribute('data-ad-status');
      const hasContent =
        status === 'filled' || (status !== 'unfilled' && el.childElementCount > 0 && el.clientHeight > 12);
      setIsAdActive(hasContent);
    };

    const observer = new MutationObserver(checkStatus);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['data-ad-status', 'style'],
      childList: true,
    });

    if (!pushedRef.current) {
      pushedRef.current = true;
      try {
        window.adsbygoogle.push({});
      } catch {
        // AdSense blocked or not yet initialized
      }
    }

    checkStatus();
    return () => observer.disconnect();
  }, [isConsented, consent.status, isTesting]);

  const applyConsent = (next: AdConsentStatus) => {
    pushedRef.current = false;
    updateConsent(next);
  };

  // Minimal consent prompt only in post-test slot when preference is unset
  if (consent.status === 'unset') {
    if (placement !== 'post-test-card') return null;
    return (
      <AnimatePresence>
        <motion.aside
          initial={{opacity: 0, y: 6}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: -4}}
          transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          aria-label="Ad consent preferences"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#0D1322] px-5 py-3.5 text-xs vx-card transition-colors duration-200"
        >
          <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300">
            <ShieldCheck
              className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0"
              aria-hidden="true"
            />
            <span>
              Allow Google AdSense to support Veloxis? Ads stay paused during speed tests.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => applyConsent('personalized')}
              className="rounded-lg bg-[#EAE6DD]/70 dark:bg-[#131C31] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Allow Ads
            </button>
            <button
              type="button"
              onClick={() => applyConsent('non_personalized')}
              className="rounded-lg bg-[#F8F7F4] dark:bg-[#131C31] px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Non-Personalized
            </button>
            <button
              type="button"
              onClick={() => applyConsent('declined')}
              className="px-2 py-1.5 text-xs font-medium text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
            >
              Decline
            </button>
          </div>
        </motion.aside>
      </AnimatePresence>
    );
  }

  // Never render placeholder boxes when declined, testing, or no live ad is active
  if (!isConsented || isTesting) {
    return null;
  }

  return (
    <div
      aria-hidden={!isAdActive}
      className={
        isAdActive
          ? placement === 'footer-banner'
            ? 'mx-auto w-full max-w-[728px] overflow-hidden rounded-lg bg-white dark:bg-[#0D1322] p-2 vx-card'
            : 'overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] p-3 vx-card'
          : 'sr-only h-0 overflow-hidden pointer-events-none'
      }
    >
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{display: 'block'}}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-format={placement === 'footer-banner' ? 'horizontal' : 'auto'}
        data-full-width-responsive="true"
      />
    </div>
  );
};
