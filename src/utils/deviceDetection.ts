import type {BrowserConnectionHint, DetectedDevice} from '../types/speedtest';

const DEVICE_ID_KEY = 'veloxis_device_id_v1';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `vx_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `vx_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export function detectLocalDeviceMetadata(hint: BrowserConnectionHint): {
  deviceId: string;
  label: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  linkType: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const uaData = (
    navigator as unknown as {
      userAgentData?: {platform?: string; mobile?: boolean};
    }
  ).userAgentData;

  let os = 'Desktop OS';
  if (/iPhone/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (uaData?.platform) os = uaData.platform;

  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'Tablet';
  } else if (/Mobi|iPhone|Android/i.test(ua) || uaData?.mobile) {
    deviceType = 'Mobile';
  }

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as {standalone?: boolean}).standalone === true);

  const label = isStandalone
    ? `${os} App (${browser})`
    : `${os} · ${browser}`;

  const linkType = hint.effectiveType
    ? `${hint.effectiveType.toUpperCase()} Link`
    : 'Broadband Link';

  return {
    deviceId: getOrCreateDeviceId(),
    label,
    os,
    browser,
    deviceType,
    linkType,
  };
}

export function getBrowserResourceBytes(): number {
  try {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) {
      return 0;
    }
    const entries = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
    let total = 0;
    for (const entry of entries) {
      if (entry.transferSize && entry.transferSize > 0) {
        total += entry.transferSize;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export function formatDataVolume(bytes: number): string {
  if (bytes <= 0) return '0.0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  if (mb >= 10) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${mb.toFixed(2)} MB`;
}

export function buildDetectedDeviceList(params: {
  serverDevices: Array<{
    deviceId: string;
    label: string;
    os: string;
    browser: string;
    deviceType: string;
    linkType: string;
    rttMs: number;
    bytesDown: number;
    bytesUp: number;
    downloadMbps: number;
    uploadMbps: number;
    lastSeenAt: number;
  }>;
  currentDeviceId: string;
  measuredDownloadMbps: number;
  isTesting: boolean;
}): DetectedDevice[] {
  const {serverDevices, currentDeviceId, measuredDownloadMbps, isTesting} = params;
  const count = Math.max(1, serverDevices.length);
  const totalBytesAll = serverDevices.reduce(
    (sum, d) => sum + Math.max(0, d.bytesDown + d.bytesUp),
    0,
  );

  return serverDevices.map((dev) => {
    const isCurrent = dev.deviceId === currentDeviceId;
    const bytesUsed = Math.max(0, dev.bytesDown + dev.bytesUp);
    const shareMbps =
      measuredDownloadMbps > 0
        ? measuredDownloadMbps / count
        : dev.downloadMbps > 0
          ? dev.downloadMbps / count
          : 0;

    // Exact maximum hourly transfer capacity at this device's measured bandwidth share (no guessed duty cycle)
    const estimatedGbPerHour =
      shareMbps > 0 ? (shareMbps * 3600) / (8 * 1024) : null;

    const usagePct =
      totalBytesAll > 0
        ? Math.round((bytesUsed / totalBytesAll) * 100)
        : Math.round(100 / count);

    const ageMs = Date.now() - dev.lastSeenAt;
    const status: DetectedDevice['status'] =
      isCurrent && isTesting ? 'Testing' : ageMs < 90_000 ? 'Active' : 'Idle';

    const deviceType: DetectedDevice['deviceType'] =
      dev.deviceType === 'Mobile' || dev.deviceType === 'Tablet'
        ? dev.deviceType
        : 'Desktop';

    return {
      deviceId: dev.deviceId,
      label: dev.label,
      os: dev.os,
      browser: dev.browser,
      deviceType,
      isCurrentDevice: isCurrent,
      linkType: dev.linkType,
      rttMs: dev.rttMs,
      bytesDown: dev.bytesDown,
      bytesUp: dev.bytesUp,
      totalBytesUsed: bytesUsed,
      bandwidthShareMbps: shareMbps,
      estimatedGbPerHour,
      usagePct,
      status,
      lastSeenAt: dev.lastSeenAt,
    };
  });
}
