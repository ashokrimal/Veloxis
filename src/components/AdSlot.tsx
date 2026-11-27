import React, {useEffect, useState} from 'react';
import {Check, ExternalLink, ShieldCheck, SlidersHorizontal} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {
  AD_TOPICS,
  type AdConsentStatus,
  type AdTopicId,
  useAdConsent,
} from '../hooks/useAdConsent';

interface AdSlotProps {
  placement: 'post-test-card' | 'footer-banner';
  isTesting: boolean;
  measuredDownloadMbps?: number;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[] & {requestNonPersonalizedAds?: number};
  }
}

export const AdSlot: React.FC<AdSlotProps> = ({
  placement,
  isTesting,
  measuredDownloadMbps = 0,
}) => {
  const {consent, updateConsent, toggleTopic} = useAdConsent();
  const [isEditingPrefs, setIsEditingPrefs] = useState(false);

  const isConsented =
    consent.status === 'personalized' || consent.status === 'non_personalized';

  const clientId =
    (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) ||
    'ca-pub-1138327552755079';
  const slotId =
    placement === 'footer-banner'
      ? (import.meta.env.VITE_ADSENSE_FOOTER_SLOT as string | undefined)
      : (import.meta.env.VITE_ADSENSE_CARD_SLOT as string | undefined);

  const hasLiveAdSense = Boolean(clientId && slotId);

  useEffect(() => {
    if (!isConsented || !hasLiveAdSense || isTesting) return;

    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds =
      consent.status === 'non_personalized' ? 1 : 0;

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
      window.adsbygoogle.push({});
    } catch {
      // AdSense script still loading or blocked by user extension
    }
  }, [isConsented, consent.status, hasLiveAdSense, isTesting, clientId, slotId]);

  const pickPreferredTopicContent = () => {
    const firstId: AdTopicId | undefined = consent.preferredTopics[0];
    if (firstId) {
      const match = AD_TOPICS.find((t) => t.id === firstId);
      if (match) return match;
    }
    if (measuredDownloadMbps > 0 && measuredDownloadMbps < 100) {
      return AD_TOPICS[0];
    }
    return AD_TOPICS[1];
  };

  const applyConsentChoice = (nextStatus: AdConsentStatus) => {
    updateConsent(nextStatus);
    setIsEditingPrefs(false);
  };

  const renderPreferenceControls = (compact = false) => (
    <motion.div
      initial={{opacity: 0, y: 6}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: -4}}
      transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ShieldCheck
            className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Choose Your Ad Experience &amp; Preferred Topics
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Ads are paused until you choose a preference. No third-party ad script loads without your consent, and ads never run during active speed tests.
            </p>
          </div>
        </div>
        {isEditingPrefs && (
          <button
            type="button"
            onClick={() => setIsEditingPrefs(false)}
            className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Done
          </button>
        )}
      </div>

      {/* Topic Preferences */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Preferred topics:
          </span>
          {AD_TOPICS.map((topic) => {
            const active = consent.preferredTopics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {active && <Check className="h-3 w-3" aria-hidden="true" />}
                <span>{topic.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Consent Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyConsentChoice('personalized')}
          className="rounded-lg bg-blue-600 dark:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          Allow Relevant Ads
        </button>
        <button
          type="button"
          onClick={() => applyConsentChoice('non_personalized')}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
        >
          Non-Personalized Only
        </button>
        <button
          type="button"
          onClick={() => applyConsentChoice('declined')}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          Decline Ads
        </button>
      </div>
    </motion.div>
  );

  // PLACEMENT 1: POST-TEST SPONSORED CARD
  if (placement === 'post-test-card') {
    const activeTopic = pickPreferredTopicContent();

    return (
      <motion.aside
        layout
        initial={{opacity: 0, y: 8}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.24, ease: [0.16, 1, 0.3, 1]}}
        aria-label="Sponsored placement and ad consent"
        className="min-h-[112px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 sm:p-5 transition-colors duration-200"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            {consent.status === 'unset'
              ? 'Ad Consent Required'
              : consent.status === 'declined'
                ? 'Ads Paused · Privacy Mode'
                : consent.status === 'non_personalized'
                  ? 'Sponsored · Non-Personalized'
                  : 'Sponsored · Tailored to Your Preferences'}
          </span>
          <button
            type="button"
            onClick={() => setIsEditingPrefs((v) => !v)}
            className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
            <span>Ad Preferences</span>
          </button>
        </div>

        <div className="mt-3">
          <AnimatePresence mode="wait">
            {consent.status === 'unset' || isEditingPrefs ? (
              <div key="consent-editor">{renderPreferenceControls(false)}</div>
            ) : consent.status === 'declined' ? (
              <motion.div
                key="declined"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.18}}
                className="flex flex-wrap items-center justify-between gap-3 py-1 text-xs text-slate-500 dark:text-slate-400"
              >
                <span>
                  Ad scripts are disabled based on your consent settings.
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPrefs(true)}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Update Ad Preferences
                </button>
              </motion.div>
            ) : hasLiveAdSense && !isTesting ? (
              <motion.div
                key="live-adsense"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                className="min-h-[72px]"
              >
                <ins
                  className="adsbygoogle block"
                  style={{display: 'block'}}
                  data-ad-client={clientId}
                  data-ad-slot={slotId}
                  data-ad-format="auto"
                  data-full-width-responsive="true"
                />
              </motion.div>
            ) : (
              <motion.div
                key={`topic-${activeTopic.id}`}
                initial={{opacity: 0, y: 4}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -4}}
                transition={{duration: 0.2}}
                className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activeTopic.headline}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {activeTopic.summary}
                  </p>
                </div>
                <a
                  href="#benchmark"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Compare Plans</span>
                  <ExternalLink className="h-3 w-3 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    );
  }

  // PLACEMENT 2: FOOTER BANNER (Strictly gated by consent)
  if (!isConsented) {
    return (
      <div
        aria-label="Ad consent footer status"
        className="mx-auto w-full max-w-[728px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3"
      >
        <span>
          {consent.status === 'declined'
            ? 'Footer ads hidden by your privacy preference.'
            : 'Footer ads are gated until you set your ad consent preference above.'}
        </span>
        <button
          type="button"
          onClick={() => updateConsent('non_personalized')}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
        >
          Allow Non-Personalized Ads
        </button>
      </div>
    );
  }

  const activeTopic = pickPreferredTopicContent();

  return (
    <div
      aria-label="Sponsored footer placement"
      className="mx-auto w-full max-w-[728px] min-h-[68px] sm:min-h-[84px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-4 py-3 flex flex-col justify-center transition-colors duration-200"
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
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Sponsored
            </span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {activeTopic.headline}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            {consent.status === 'non_personalized' ? 'Contextual' : 'Tailored'} ·{' '}
            {activeTopic.label}
          </span>
        </div>
      )}
    </div>
  );
};
