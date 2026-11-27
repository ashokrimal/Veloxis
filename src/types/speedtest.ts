export type TestPhase =
  | 'idle'
  | 'ping'
  | 'download'
  | 'upload'
  | 'complete'
  | 'monitoring'
  | 'error';

export type TestMode = 'precision' | 'realtime';

export type NavSection = 'speedtest' | 'monitor' | 'benchmark' | 'history';

export interface NetworkInfo {
  ip: string;
  isp: string;
  asn: string;
  city: string;
  region: string;
  country: string;
  serverNode: string;
  detected: boolean;
}

export interface BrowserConnectionHint {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export type VerdictTier = 'Optimal' | 'Good' | 'Fair' | 'Limited';

export interface ActivityVerdict {
  id: 'streaming' | 'gaming' | 'browsing';
  title: string;
  tier: VerdictTier;
  summary: string;
  metricLabel: string;
  metricValue: string;
}

export interface TelemetrySample {
  t: number; // seconds since test start
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
}

export interface SpeedTestResult {
  id: string;
  timestamp: string;
  mode: TestMode;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  jitterMs: number;
  packetLossPct: number;
  veloxisScore: number;
  activities: ActivityVerdict[];
  network: NetworkInfo;
  samples: TelemetrySample[];
}

export interface BenchmarkProfile {
  planName: string;
  subscribedDownloadMbps: number;
  subscribedUploadMbps: number;
  monthlyPriceUsd: number;
  connectedDevices: number;
  active4KStreams: number;
  gamingDevices: number;
}
