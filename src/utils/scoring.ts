import type {
  ActivityVerdict,
  BenchmarkProfile,
  BufferbloatSummary,
  SpeedTestResult,
  SpeedUnit,
  VerdictTier,
} from '../types/speedtest';

const MB = 1024 * 1024;
const GB = 1024 * MB;

export function convertSpeed(mbps: number, unit: SpeedUnit): number {
  return unit === 'MBps' ? mbps / 8 : mbps;
}

export function toMbps(value: number, unit: SpeedUnit): number {
  return unit === 'MBps' ? value * 8 : value;
}

export function formatSpeedValue(mbps: number, unit: SpeedUnit): string {
  const val = convertSpeed(mbps, unit);
  if (unit === 'MBps') {
    return val < 10 ? val.toFixed(2) : val.toFixed(1);
  }
  return val.toFixed(1);
}

export function speedToNormalized(mbps: number, maxMbps = 1000): number {
  if (mbps <= 0) return 0;
  const clamped = Math.min(maxMbps, Math.max(0, mbps));
  return Math.min(1, Math.log10(clamped + 1) / Math.log10(maxMbps + 1));
}

export function formatTransferSize(bytes: number): string {
  if (bytes >= GB) {
    const val = bytes / GB;
    return `${Number.isInteger(val) ? val : val.toFixed(2)} GB`;
  }
  const mb = bytes / MB;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function formatDuration(seconds: number, showTenths = true): string {
  const safe = Math.max(0, seconds);
  if (safe < 60) {
    return showTenths && safe < 100
      ? `${safe.toFixed(1)}s`
      : `${Math.round(safe)}s`;
  }
  const mins = Math.floor(safe / 60);
  const rem = Math.round(safe % 60);
  if (rem === 60) return `${mins + 1}m 0s`;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

export function estimateTestDurationSec(params: {
  mode: 'precision' | 'file' | 'realtime';
  downloadBytes?: number;
  uploadBytes?: number;
  downloadMbps?: number | null;
  uploadMbps?: number | null;
}): number | null {
  if (params.mode === 'precision') {
    // 10 quick ping probes (~1.5s) + 6s download + 5s upload
    return 12.5;
  }
  if (params.mode === 'file') {
    const dlMbps = params.downloadMbps;
    if (!dlMbps || dlMbps <= 0) return null;
    const ulMbps =
      params.uploadMbps && params.uploadMbps > 0 ? params.uploadMbps : dlMbps;
    const dlBytes = params.downloadBytes ?? 500 * MB;
    const ulBytes = params.uploadBytes ?? 500 * MB;
    const dlSec = (dlBytes * 8) / (dlMbps * 1_000_000);
    const ulSec = (ulBytes * 8) / (ulMbps * 1_000_000);
    return Math.max(3, 1.5 + dlSec + ulSec);
  }
  return null;
}

export function computeSubscriptionTransferBytes(
  planValueInUnit: number | null,
): number {
  if (planValueInUnit === null || planValueInUnit <= 0) {
    return 500 * MB;
  }
  // Maps subscription speed directly to sustained file transfer payload:
  // 50 -> 500 MB, 100 -> 1 GB, 200 -> 2 GB (capped safely at 2 GB per direction)
  if (planValueInUnit >= 100 && Math.abs(planValueInUnit % 100) < 0.01) {
    const gb = Math.min(2, Math.max(1, Math.round(planValueInUnit / 100)));
    return gb * GB;
  }
  const mb = Math.max(100, Math.min(2048, Math.round(planValueInUnit * 10)));
  return mb * MB;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const safeCode = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCode,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${safeCode} ${amount.toFixed(2)}`;
  }
}

export function getClosestStandardTierMbps(measuredMbps: number): number | null {
  if (measuredMbps <= 0) return null;
  const tiers = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000];
  let best = tiers[0];
  let bestDiff = Math.abs(measuredMbps - best);
  for (const tier of tiers) {
    const diff = Math.abs(measuredMbps - tier);
    if (diff < bestDiff) {
      best = tier;
      bestDiff = diff;
    }
  }
  return best;
}

export function calculateVeloxisScore(params: {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  jitterMs: number;
  packetLossPct: number;
}): number {
  const {downloadMbps, uploadMbps, pingMs, loadedPingMs, jitterMs, packetLossPct} = params;

  const dlScore = Math.min(38, Math.log10(Math.max(1, downloadMbps) + 1) * 14.5);
  const ulScore = Math.min(22, Math.log10(Math.max(1, uploadMbps) + 1) * 9.5);

  const unloadedPenalty = Math.max(0, (pingMs - 15) * 0.22);
  const bloatDelta = Math.max(0, loadedPingMs - pingMs);
  const bloatPenalty = Math.max(0, (bloatDelta - 10) * 0.14);
  const pingScore = Math.max(0, 24 - unloadedPenalty - bloatPenalty);

  const jitterPenalty = Math.max(0, (jitterMs - 3) * 0.45);
  const lossPenalty = packetLossPct * 4.5;
  const stabilityScore = Math.max(0, 16 - jitterPenalty - lossPenalty);

  return Math.max(1, Math.min(100, Math.round(dlScore + ulScore + pingScore + stabilityScore)));
}

export function getScoreLabel(score: number): {
  label: string;
  tone: 'emerald' | 'blue' | 'amber' | 'rose';
} {
  if (score >= 85) return {label: 'Exceptional', tone: 'emerald'};
  if (score >= 68) return {label: 'Strong', tone: 'blue'};
  if (score >= 45) return {label: 'Fair', tone: 'amber'};
  return {label: 'Constrained', tone: 'rose'};
}

export function evaluateBufferbloat(
  unloadedPingMs: number,
  loadedPingMs: number,
): BufferbloatSummary {
  const deltaMs = Math.max(0, Number((loadedPingMs - unloadedPingMs).toFixed(1)));
  if (deltaMs <= 5) {
    return {
      grade: 'A+',
      deltaMs,
      label: 'Zero Bufferbloat',
      summary: 'Latency stays flat under full load — ideal for competitive gaming and real-time voice.',
    };
  }
  if (deltaMs <= 15) {
    return {
      grade: 'A',
      deltaMs,
      label: 'Minimal Bufferbloat',
      summary: 'Very low latency increase during heavy transfers.',
    };
  }
  if (deltaMs <= 30) {
    return {
      grade: 'B',
      deltaMs,
      label: 'Low Bufferbloat',
      summary: 'Manageable latency spike under load; smooth for most streaming and calls.',
    };
  }
  if (deltaMs <= 60) {
    return {
      grade: 'C',
      deltaMs,
      label: 'Moderate Bufferbloat',
      summary: 'Noticeable ping rise during uploads/downloads; QoS or SQM router shaping can help.',
    };
  }
  if (deltaMs <= 120) {
    return {
      grade: 'D',
      deltaMs,
      label: 'High Bufferbloat',
      summary: 'Significant latency inflation under load; video calls and gaming may lag during downloads.',
    };
  }
  return {
    grade: 'F',
    deltaMs,
    label: 'Severe Bufferbloat',
    summary: 'Heavy router queue buildup under load; enable SQM / Smart Queue Management on your router.',
  };
}

export function evaluateActivities(params: {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  jitterMs: number;
  packetLossPct: number;
}): ActivityVerdict[] {
  const {downloadMbps, uploadMbps, pingMs, loadedPingMs, jitterMs, packetLossPct} = params;

  const max4KStreams = Math.floor(downloadMbps / 25);
  let streamTier: VerdictTier = 'Limited';
  let streamSummary = 'Best suited for standard definition video.';
  if (downloadMbps >= 50 && jitterMs < 25 && packetLossPct < 1) {
    streamTier = 'Optimal';
    streamSummary = `Supports up to ${Math.max(2, max4KStreams)} simultaneous 4K HDR streams without buffering.`;
  } else if (downloadMbps >= 25) {
    streamTier = 'Good';
    streamSummary = 'Handles single 4K UHD stream or multiple 1080p HD streams cleanly.';
  } else if (downloadMbps >= 8) {
    streamTier = 'Fair';
    streamSummary = 'Reliable for 1080p HD playback on one primary screen.';
  }

  const bloatDelta = Math.max(0, loadedPingMs - pingMs);
  let gamingTier: VerdictTier = 'Limited';
  let gamingSummary = 'Noticeable latency spikes or packet instability under load.';
  if (pingMs <= 35 && jitterMs <= 8 && packetLossPct === 0 && bloatDelta <= 45) {
    gamingTier = 'Optimal';
    gamingSummary = 'Low-latency response ideal for competitive FPS and cloud gaming.';
  } else if (pingMs <= 65 && jitterMs <= 18 && packetLossPct <= 0.5) {
    gamingTier = 'Good';
    gamingSummary = 'Smooth multiplayer matchmaking with minor variance during heavy downloads.';
  } else if (pingMs <= 110 && packetLossPct <= 2) {
    gamingTier = 'Fair';
    gamingSummary = 'Playable for casual online titles; avoid concurrent large downloads.';
  }

  let browsingTier: VerdictTier = 'Limited';
  let browsingSummary = 'Slow media-heavy page loads and possible video call freezes.';
  if (downloadMbps >= 20 && uploadMbps >= 10 && pingMs <= 75 && packetLossPct < 1) {
    browsingTier = 'Optimal';
    browsingSummary = 'Instant page loads and crisp 1080p multi-participant video calls.';
  } else if (downloadMbps >= 10 && uploadMbps >= 3) {
    browsingTier = 'Good';
    browsingSummary = 'Responsive everyday web browsing and stable HD video conferencing.';
  } else if (downloadMbps >= 3 && uploadMbps >= 1) {
    browsingTier = 'Fair';
    browsingSummary = 'Adequate for document work and audio-first meetings.';
  }

  return [
    {
      id: 'streaming',
      title: '4K & HD Streaming',
      tier: streamTier,
      summary: streamSummary,
      metricLabel: '4K Stream Capacity',
      metricValue: max4KStreams > 0 ? `${max4KStreams} concurrent` : '1080p max',
    },
    {
      id: 'gaming',
      title: 'Online Gaming',
      tier: gamingTier,
      summary: gamingSummary,
      metricLabel: 'Loaded Latency Delta',
      metricValue: `+${Math.round(bloatDelta)} ms`,
    },
    {
      id: 'browsing',
      title: 'Browsing & Video Calls',
      tier: browsingTier,
      summary: browsingSummary,
      metricLabel: 'Upload Headroom',
      metricValue: `${uploadMbps.toFixed(1)} Mbps`,
    },
  ];
}

export function calculatePlanBenchmark(
  profile: BenchmarkProfile,
  measuredDownloadMbps: number,
  measuredUploadMbps: number,
  detectedDeviceCount: number,
) {
  const safeDevices = Math.max(1, detectedDeviceCount);
  const perDeviceMbps = measuredDownloadMbps / safeDevices;

  const downloadDeliveryPct =
    profile.subscribedDownloadMbps !== null && profile.subscribedDownloadMbps > 0
      ? Math.round((measuredDownloadMbps / profile.subscribedDownloadMbps) * 100)
      : null;

  const uploadDeliveryPct =
    profile.subscribedUploadMbps !== null && profile.subscribedUploadMbps > 0
      ? Math.round((measuredUploadMbps / profile.subscribedUploadMbps) * 100)
      : null;

  const costPer100Mbps =
    profile.monthlyPrice !== null && profile.monthlyPrice > 0 && measuredDownloadMbps > 0
      ? (profile.monthlyPrice / measuredDownloadMbps) * 100
      : null;

  let capacityStatus: 'Optimal' | 'Balanced' | 'Congested' = 'Optimal';
  if (
    perDeviceMbps < 15 ||
    (downloadDeliveryPct !== null && downloadDeliveryPct < 50)
  ) {
    capacityStatus = 'Congested';
  } else if (
    perDeviceMbps < 35 ||
    (downloadDeliveryPct !== null && downloadDeliveryPct < 75)
  ) {
    capacityStatus = 'Balanced';
  }

  return {
    downloadDeliveryPct,
    uploadDeliveryPct,
    perDeviceMbps,
    costPer100Mbps,
    capacityStatus,
  };
}

export function exportHistoryCSV(results: SpeedTestResult[]): void {
  const headers = [
    'Timestamp',
    'Mode',
    'Veloxis Score',
    'Download (Mbps)',
    'Download (MBps)',
    'Upload (Mbps)',
    'Upload (MBps)',
    'Ping (ms)',
    'Loaded Ping (ms)',
    'Jitter (ms)',
    'Packet Loss (%)',
    'Bufferbloat Grade',
    'Duration (s)',
    'ISP',
    'Country',
    'Server Node',
  ];
  const rows = results.map((r) => [
    r.timestamp,
    r.mode,
    r.veloxisScore,
    r.downloadMbps.toFixed(2),
    (r.downloadMbps / 8).toFixed(2),
    r.uploadMbps.toFixed(2),
    (r.uploadMbps / 8).toFixed(2),
    r.pingMs.toFixed(1),
    r.loadedPingMs.toFixed(1),
    r.jitterMs.toFixed(1),
    r.packetLossPct.toFixed(1),
    r.bufferbloatGrade ?? evaluateBufferbloat(r.pingMs, r.loadedPingMs).grade,
    r.durationSec !== undefined ? r.durationSec.toFixed(1) : '',
    `"${(r.network.isp || 'Unknown').replace(/"/g, '""')}"`,
    `"${(r.network.country || '').replace(/"/g, '""')}"`,
    `"${r.network.serverNode.replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `veloxis-speedtest-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
