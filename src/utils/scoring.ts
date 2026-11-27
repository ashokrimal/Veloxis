import type {
  ActivityVerdict,
  BenchmarkProfile,
  SpeedTestResult,
  VerdictTier,
} from '../types/speedtest';

export function calculateVeloxisScore(params: {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  jitterMs: number;
  packetLossPct: number;
}): number {
  const {downloadMbps, uploadMbps, pingMs, loadedPingMs, jitterMs, packetLossPct} = params;

  // Download (up to 38 pts): logarithmic curve so 100 Mbps ~ 29, 300+ Mbps ~ 36-38
  const dlScore = Math.min(38, Math.log10(Math.max(1, downloadMbps) + 1) * 14.5);

  // Upload (up to 22 pts)
  const ulScore = Math.min(22, Math.log10(Math.max(1, uploadMbps) + 1) * 9.5);

  // Latency & Bufferbloat (up to 24 pts)
  const unloadedPenalty = Math.max(0, (pingMs - 15) * 0.22);
  const bloatDelta = Math.max(0, loadedPingMs - pingMs);
  const bloatPenalty = Math.max(0, (bloatDelta - 10) * 0.14);
  const pingScore = Math.max(0, 24 - unloadedPenalty - bloatPenalty);

  // Jitter & Packet Loss (up to 16 pts)
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

export function evaluateActivities(params: {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  jitterMs: number;
  packetLossPct: number;
}): ActivityVerdict[] {
  const {downloadMbps, uploadMbps, pingMs, loadedPingMs, jitterMs, packetLossPct} = params;

  // 1. Streaming
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

  // 2. Gaming
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

  // 3. Browsing & Video Calls
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
) {
  const safeSubDl = Math.max(1, profile.subscribedDownloadMbps);
  const safeSubUl = Math.max(1, profile.subscribedUploadMbps);
  const safeDevices = Math.max(1, profile.connectedDevices);

  const downloadDeliveryPct = Math.round((measuredDownloadMbps / safeSubDl) * 100);
  const uploadDeliveryPct = Math.round((measuredUploadMbps / safeSubUl) * 100);

  // Reserve ~25 Mbps per active 4K stream and ~5 Mbps per gaming device to show remaining shared headroom
  const reservedDemandMbps = profile.active4KStreams * 25 + profile.gamingDevices * 5;
  const perDeviceMbps = measuredDownloadMbps / safeDevices;
  const remainingMbps = Math.max(0, measuredDownloadMbps - reservedDemandMbps);
  const costPer100Mbps =
    measuredDownloadMbps > 0 ? (profile.monthlyPriceUsd / measuredDownloadMbps) * 100 : 0;

  let capacityStatus: 'Optimal' | 'Balanced' | 'Congested' = 'Optimal';
  if (perDeviceMbps < 10 || remainingMbps < 15) {
    capacityStatus = 'Congested';
  } else if (perDeviceMbps < 25 || downloadDeliveryPct < 70) {
    capacityStatus = 'Balanced';
  }

  return {
    downloadDeliveryPct,
    uploadDeliveryPct,
    perDeviceMbps,
    reservedDemandMbps,
    remainingMbps,
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
    'Upload (Mbps)',
    'Ping (ms)',
    'Loaded Ping (ms)',
    'Jitter (ms)',
    'Packet Loss (%)',
    'ISP',
    'Server Node',
  ];
  const rows = results.map((r) => [
    r.timestamp,
    r.mode,
    r.veloxisScore,
    r.downloadMbps.toFixed(2),
    r.uploadMbps.toFixed(2),
    r.pingMs.toFixed(1),
    r.loadedPingMs.toFixed(1),
    r.jitterMs.toFixed(1),
    r.packetLossPct.toFixed(1),
    `"${r.network.isp.replace(/"/g, '""')}"`,
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
