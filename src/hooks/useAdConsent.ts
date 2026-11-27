import {useCallback, useEffect, useState} from 'react';

export type AdConsentStatus =
  | 'unset'
  | 'personalized'
  | 'non_personalized'
  | 'declined';

export type AdTopicId = 'isp' | 'hardware' | 'privacy' | 'cloud';

export interface AdConsentState {
  status: AdConsentStatus;
  preferredTopics: AdTopicId[];
  updatedAt: string | null;
}

export const AD_TOPICS: Array<{
  id: AdTopicId;
  label: string;
  headline: string;
  summary: string;
}> = [
  {
    id: 'isp',
    label: 'Fiber & ISP Plans',
    headline: 'Compare Symmetrical Fiber & Regional ISP Plans',
    summary: 'Review gigabit fiber tiers, upload parity, and transparent local broadband pricing.',
  },
  {
    id: 'hardware',
    label: 'Wi-Fi 7 & Routers',
    headline: 'Eliminate Bufferbloat with SQM & Wi-Fi 7 Mesh Hardware',
    summary: 'Low-latency multi-gigabit routers tuned for 4K streaming and competitive gaming.',
  },
  {
    id: 'privacy',
    label: 'DNS & VPN Privacy',
    headline: 'Protect High-Speed Connections with Encrypted DNS & VPNs',
    summary: 'Audited WireGuard tunneling and DNS-over-HTTPS with minimal throughput overhead.',
  },
  {
    id: 'cloud',
    label: 'Cloud & Dev Hosting',
    headline: 'Low-Latency Edge Compute & Bare-Metal Cloud Nodes',
    summary: 'High-bandwidth cloud instances engineered for fast uploads and global routing.',
  },
];

const CONSENT_STORAGE_KEY = 'veloxis_ad_consent_v1';
const CONSENT_EVENT = 'veloxis-ad-consent-updated';

const DEFAULT_CONSENT: AdConsentState = {
  status: 'unset',
  preferredTopics: ['isp', 'hardware'],
  updatedAt: null,
};

function loadConsent(): AdConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<AdConsentState>;
    const validStatus: AdConsentStatus =
      parsed.status === 'personalized' ||
      parsed.status === 'non_personalized' ||
      parsed.status === 'declined'
        ? parsed.status
        : 'unset';
    const validTopics = Array.isArray(parsed.preferredTopics)
      ? parsed.preferredTopics.filter((t): t is AdTopicId =>
          AD_TOPICS.some((item) => item.id === t),
        )
      : DEFAULT_CONSENT.preferredTopics;
    return {
      status: validStatus,
      preferredTopics: validTopics,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function useAdConsent() {
  const [consent, setConsent] = useState<AdConsentState>(loadConsent);

  useEffect(() => {
    const sync = () => setConsent(loadConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const persistConsent = useCallback((next: AdConsentState) => {
    setConsent(next);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  }, []);

  const updateConsent = useCallback(
    (status: AdConsentStatus, preferredTopics?: AdTopicId[]) => {
      const current = loadConsent();
      persistConsent({
        status,
        preferredTopics: preferredTopics ?? current.preferredTopics,
        updatedAt: new Date().toISOString(),
      });
    },
    [persistConsent],
  );

  const toggleTopic = useCallback(
    (topicId: AdTopicId) => {
      const current = loadConsent();
      const exists = current.preferredTopics.includes(topicId);
      const nextTopics = exists
        ? current.preferredTopics.filter((id) => id !== topicId)
        : [...current.preferredTopics, topicId];
      persistConsent({
        ...current,
        preferredTopics: nextTopics,
        updatedAt: new Date().toISOString(),
      });
    },
    [persistConsent],
  );

  const resetConsent = useCallback(() => {
    persistConsent({
      status: 'unset',
      preferredTopics: DEFAULT_CONSENT.preferredTopics,
      updatedAt: null,
    });
  }, [persistConsent]);

  return {
    consent,
    updateConsent,
    toggleTopic,
    resetConsent,
  };
}
