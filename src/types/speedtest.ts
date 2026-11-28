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
  lat?: number;
  lon?: number;
  distanceKm?: number | null;
}

export interface CalibrationDeviceInfo {
  deviceModel?: string;
  platformVersion?: string;
  cpuCores?: number;
  memoryGb?: number;
  effectiveType?: string;
  downlinkMbps?: number;
  saveData?: boolean;
  recommendedStreams: number;
}

export interface DnsBenchmarkEntry {
  id: string;
  name: string;
  ip: string;
  latencyMs: number | null;
  minMs?: number | null;
  maxMs?: number | null;
  sampleCount?: number;
  protocol?: 'DoH' | 'System DNS';
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

export interface TestLocationSummary {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  accuracyKm?: number;
}

export interface SpeedTestResult {
  id: string;
  timestamp: string;
  mode: TestMode;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  loadedPingMs: number;
  downloadLoadedPingMs?: number;
  uploadLoadedPingMs?: number;
  jitterMs: number;
  packetLossPct: number;
  veloxisScore: number;
  bufferbloatGrade?: BufferbloatGrade;
  activities: ActivityVerdict[];
  network: NetworkInfo;
  testLocation?: TestLocationSummary;
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

export type RouterMode =
  | 'Primary Gateway'
  | 'Router Mode (Double-NAT)'
  | 'Access Point (AP) Mode'
  | 'Bridge Mode'
  | 'Mesh Node'
  | 'Unknown';

export type NetworkDeviceCategory =
  | 'router'
  | 'mobile'
  | 'laptop'
  | 'landline'
  | 'tv'
  | 'other';

export interface NetworkRouterNode {
  id: string;
  role: 'primary' | 'secondary';
  mode: RouterMode;
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  hopIndex: number;
  latencyMs?: number | null;
  subnet?: string;
}

export interface NetworkTopologyDevice {
  id: string;
  category: NetworkDeviceCategory;
  label: string;
  ip?: string;
  mac?: string;
  vendor?: string;
  routerRole?: 'primary' | 'secondary' | 'unknown';
  source: 'lan-probe' | 'veloxis-session';
  isCurrentDevice?: boolean;
  rttMs?: number | null;
  lastSeenAt: number;
}

export interface NetworkTopologyReport {
  token: string;
  publicIp: string;
  isp: string;
  asn: string;
  probeConnected: boolean;
  lastScannedAt: number | null;
  source: 'lan-probe' | 'veloxis-sessions';
  routers: NetworkRouterNode[];
  devices: NetworkTopologyDevice[];
  categoryCounts: Record<NetworkDeviceCategory, number> & {total: number};
  notes?: string;
}

export interface WebRtcProbeResult {
  supported: boolean;
  probedAt: number;
  localIps: string[];
  reflexiveIps: string[];
  mdnsCandidates: number;
  candidateTypes: string[];
  natMismatch: boolean;
  subnetHint: string | null;
}

