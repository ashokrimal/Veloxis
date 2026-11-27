export type TestPhase =
  | 'idle'
  | 'ping'
  | 'download'
  | 'upload'
  | 'complete'
  | 'monitoring'
  | 'error';

export type TestMode = 'precision' | 'file' | 'realtime';

export type SpeedUnit = 'Mbps' | 'MBps';

export type BufferbloatGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface BufferbloatSummary {
  grade: BufferbloatGrade;
  deltaMs: number;
  label: string;
  summary: string;
}

export interface EdgeNode {
  id: string;
  label: string;
  region: string;
  rttMs: number | null;
  available: boolean;
  isPrimary?: boolean;
}

export interface DnsBenchmarkEntry {
  id: string;
  name: string;
  ip: string;
  latencyMs: number | null;
  status: 'Fast' | 'Average' | 'Slow' | 'Unavailable';
}

export interface TransferProgress {
  bytes: number;
  targetBytes: number;
}

export interface NetworkInfo {
  ip: string;
  isp: string;
  asn: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  currencyCode: string;
  serverNode: string;
  detected: boolean;
}

export interface RegionalOperator {
  id: number;
  name: string;
  city: string;
  state: string;
  website: string;
}

export interface RegionalIspsResponse {
  countryCode: string;
  operators: RegionalOperator[];
  available: boolean;
  source?: string;
  note?: string;
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
  t: number;
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
  bufferbloatGrade?: BufferbloatGrade;
  activities: ActivityVerdict[];
  network: NetworkInfo;
  samples: TelemetrySample[];
  durationSec?: number;
  transferredBytes?: {
    download: number;
    upload: number;
  };
}

export interface BenchmarkProfile {
  planName: string;
  subscribedDownloadMbps: number | null;
  subscribedUploadMbps: number | null;
  monthlyPrice: number | null;
  currencyCode: string;
}

export interface DetectedDevice {
  deviceId: string;
  label: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  isCurrentDevice: boolean;
  linkType: string;
  rttMs: number;
  bytesDown: number;
  bytesUp: number;
  totalBytesUsed: number;
  bandwidthShareMbps: number;
  estimatedGbPerHour: number | null;
  usagePct: number;
  status: 'Active' | 'Testing' | 'Idle';
  lastSeenAt: number;
}
