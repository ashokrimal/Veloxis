import {useCallback, useEffect, useRef, useState} from 'react';
import type {
  BrowserConnectionHint,
  DetectedDevice,
  EdgeNode,
  NetworkInfo,
  RegionalIspsResponse,
  SpeedTestResult,
  TelemetrySample,
  TestPhase,
  TransferProgress,
} from '../types/speedtest';
import {
  buildDetectedDeviceList,
  detectLocalDeviceMetadata,
  getBrowserResourceBytes,
} from '../utils/deviceDetection';
import {
  calculateVeloxisScore,
  evaluateActivities,
  evaluateBufferbloat,
} from '../utils/scoring';
import {
  type CalibratedLocation,
  haversineKm,
} from './useCalibrationPermissions';

const HISTORY_STORAGE_KEY = 'veloxis_speed_history_v1';

const DEFAULT_NETWORK: NetworkInfo = {
  ip: 'Detecting...',
  isp: 'Detecting ISP...',
  asn: '',
  city: '',
  region: '',
  country: '',
  countryCode: '',
  currencyCode: '',
  serverNode: 'Veloxis Edge',
  detected: false,
};

export interface PrecisionTestOptions {
  mode?: 'precision' | 'file';
  downloadBytes?: number;
  uploadBytes?: number;
  expectedDownloadMbps?: number | null;
  expectedUploadMbps?: number | null;
}

function loadSavedHistory(): SpeedTestResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items: SpeedTestResult[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // Ignore storage quota errors
  }
}

function createUploadPayload(sizeBytes: number): Uint8Array {
  const payload = new Uint8Array(sizeBytes);
  const step = 65536;
  const seed = new Uint8Array(step);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(seed);
  }
  for (let offset = 0; offset < sizeBytes; offset += step) {
    const sliceLen = Math.min(step, sizeBytes - offset);
    payload.set(sliceLen === step ? seed : seed.subarray(0, sliceLen), offset);
  }
  return payload;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeJitter(values: number[]): number {
  if (values.length < 2) return 0;
  let totalDelta = 0;
  for (let i = 1; i < values.length; i++) {
    totalDelta += Math.abs(values[i] - values[i - 1]);
  }
  return totalDelta / (values.length - 1);
}

export interface SpeedTestCalibrationOptions {
  calibratedLocation?: CalibratedLocation | null;
  recommendedStreams?: number;
}

export function useSpeedTest(calibration?: SpeedTestCalibrationOptions) {
  const calibratedLocation = calibration?.calibratedLocation ?? null;
  const recommendedStreams = calibration?.recommendedStreams ?? 4;
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [liveSpeedMbps, setLiveSpeedMbps] = useState(0);
  const [livePingMs, setLivePingMs] = useState<number | null>(null);
  const [liveJitterMs, setLiveJitterMs] = useState<number | null>(null);
  const [liveDownloadMbps, setLiveDownloadMbps] = useState<number | null>(null);
  const [liveUploadMbps, setLiveUploadMbps] = useState<number | null>(null);
  const [liveLoadedPingMs, setLiveLoadedPingMs] = useState<number | null>(null);
  const [liveDownloadLoadedPingMs, setLiveDownloadLoadedPingMs] = useState<
    number | null
  >(null);
  const [liveUploadLoadedPingMs, setLiveUploadLoadedPingMs] = useState<
    number | null
  >(null);
  const [livePacketLossPct, setLivePacketLossPct] = useState<number>(0);
  const [transferProgress, setTransferProgress] =
    useState<TransferProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [estimatedRemainingSeconds, setEstimatedRemainingSeconds] = useState<
    number | null
  >(null);

  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [latestResult, setLatestResult] = useState<SpeedTestResult | null>(() => {
    const saved = loadSavedHistory();
    return saved[0] ?? null;
  });
  const [history, setHistory] = useState<SpeedTestResult[]>(loadSavedHistory);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(DEFAULT_NETWORK);
  const [browserHint, setBrowserHint] = useState<BrowserConnectionHint>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorSamples, setMonitorSamples] = useState<TelemetrySample[]>([]);
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([]);
  const [edgeNodes, setEdgeNodes] = useState<EdgeNode[]>([
    {
      id: 'local',
      label: 'Veloxis Edge · Local Node',
      region: 'Primary Host',
      rttMs: null,
      available: true,
      isPrimary: true,
    },
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('auto');
  const [isProbingNodes, setIsProbingNodes] = useState(false);
  const [regionalIsps, setRegionalIsps] = useState<RegionalIspsResponse>({
    countryCode: '',
    operators: [],
    available: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const xhrSetRef = useRef<Set<XMLHttpRequest>>(new Set());
  const monitorTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const sessionBytesDownRef = useRef<number>(getBrowserResourceBytes());
  const sessionBytesUpRef = useRef<number>(0);

  const syncDevices = useCallback(
    async (overrides?: {
      dlMbps?: number;
      ulMbps?: number;
      rttMs?: number;
      testing?: boolean;
      hint?: BrowserConnectionHint;
    }) => {
      const hint = overrides?.hint ?? browserHint;
      const meta = detectLocalDeviceMetadata(hint);
      const measuredDl =
        overrides?.dlMbps ??
        liveDownloadMbps ??
        latestResult?.downloadMbps ??
        0;
      const measuredUl =
        overrides?.ulMbps ?? liveUploadMbps ?? latestResult?.uploadMbps ?? 0;
      const rtt =
        overrides?.rttMs ??
        livePingMs ??
        hint.rtt ??
        latestResult?.pingMs ??
        0;
      const testingNow =
        overrides?.testing ??
        (phase === 'ping' ||
          phase === 'download' ||
          phase === 'upload' ||
          isMonitoring);

      try {
        const res = await fetch('/api/devices/heartbeat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            ...meta,
            rttMs: Math.round(rtt),
            bytesDown: sessionBytesDownRef.current,
            bytesUp: sessionBytesUpRef.current,
            downloadMbps: measuredDl,
            uploadMbps: measuredUl,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            devices: Array<{
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
          };
          setDetectedDevices(
            buildDetectedDeviceList({
              serverDevices: data.devices,
              currentDeviceId: meta.deviceId,
              measuredDownloadMbps: measuredDl,
              isTesting: testingNow,
            }),
          );
          return;
        }
      } catch {
        // Fallback to local device telemetry if offline
      }

      setDetectedDevices(
        buildDetectedDeviceList({
          serverDevices: [
            {
              ...meta,
              rttMs: Math.round(rtt),
              bytesDown: sessionBytesDownRef.current,
              bytesUp: sessionBytesUpRef.current,
              downloadMbps: measuredDl,
              uploadMbps: measuredUl,
              lastSeenAt: Date.now(),
            },
          ],
          currentDeviceId: meta.deviceId,
          measuredDownloadMbps: measuredDl,
          isTesting: testingNow,
        }),
      );
    },
    [
      browserHint,
      isMonitoring,
      latestResult?.downloadMbps,
      latestResult?.pingMs,
      latestResult?.uploadMbps,
      liveDownloadMbps,
      livePingMs,
      liveUploadMbps,
      phase,
    ],
  );

  const refreshNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network-info', {cache: 'no-store'});
      if (res.ok) {
        const data = (await res.json()) as NetworkInfo;
        setNetworkInfo(data);
        if (data.detected && data.countryCode) {
          fetch(
            `/api/regional-isps?countryCode=${encodeURIComponent(data.countryCode)}&city=${encodeURIComponent(data.city || '')}`,
            {cache: 'no-store'},
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((ispData: RegionalIspsResponse | null) => {
              if (ispData) setRegionalIsps(ispData);
            })
            .catch(() => {});
        } else {
          setRegionalIsps({
            countryCode: '',
            operators: [],
            available: false,
            note: 'Country could not be detected automatically.',
          });
        }
      }
    } catch {
      // Keep existing info on transient network error
    }

    let nextHint: BrowserConnectionHint = {};
    const nav = navigator as unknown as {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    };
    if (nav.connection) {
      nextHint = {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
        saveData: nav.connection.saveData,
      };
      setBrowserHint(nextHint);
    }

    await syncDevices({hint: nextHint});
  }, [syncDevices]);

  const probeEdgeNodes = useCallback(async () => {
    setIsProbingNodes(true);
    try {
      const res = await fetch(`/api/edge-nodes?t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = (await res.json()) as {nodes?: EdgeNode[]};
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          setEdgeNodes(data.nodes);
        }
      }
    } catch {
      // Keep current edge node list on transient error
    } finally {
      setIsProbingNodes(false);
    }
  }, []);

  useEffect(() => {
    refreshNetworkInfo();
    void probeEdgeNodes();
  }, [probeEdgeNodes, refreshNetworkInfo]);

  useEffect(() => {
    if (!calibratedLocation?.countryCode) return;
    setNetworkInfo((prev) => ({
      ...prev,
      city: calibratedLocation.city || prev.city,
      region: calibratedLocation.region || prev.region,
      country: calibratedLocation.country || prev.country,
      countryCode: calibratedLocation.countryCode || prev.countryCode,
      detected: true,
    }));
    fetch(
      `/api/regional-isps?countryCode=${encodeURIComponent(calibratedLocation.countryCode)}&city=${encodeURIComponent(calibratedLocation.city || '')}`,
      {cache: 'no-store'},
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((ispData: RegionalIspsResponse | null) => {
        if (ispData) setRegionalIsps(ispData);
      })
      .catch(() => {});
  }, [
    calibratedLocation?.city,
    calibratedLocation?.country,
    calibratedLocation?.countryCode,
    calibratedLocation?.region,
  ]);

  const calibratedEdgeNodes: EdgeNode[] = edgeNodes.map((node) => {
    if (
      calibratedLocation &&
      typeof node.lat === 'number' &&
      typeof node.lon === 'number'
    ) {
      return {
        ...node,
        distanceKm: haversineKm(
          calibratedLocation.lat,
          calibratedLocation.lon,
          node.lat,
          node.lon,
        ),
      };
    }
    return node;
  });

  const effectiveNode =
    selectedNodeId === 'auto'
      ? [...calibratedEdgeNodes]
          .filter((n) => n.available)
          .sort((a, b) => {
            const rttDiff = (a.rttMs ?? 9999) - (b.rttMs ?? 9999);
            if (Math.abs(rttDiff) > 8) return rttDiff;
            return (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999);
          })[0] ??
        calibratedEdgeNodes[0] ??
        null
      : calibratedEdgeNodes.find((n) => n.id === selectedNodeId) ??
        calibratedEdgeNodes[0] ??
        null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (phase === 'idle' || phase === 'complete') {
        syncDevices();
      }
    }, 25000);
    return () => window.clearInterval(interval);
  }, [phase, syncDevices]);

  const stopAll = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    xhrSetRef.current.forEach((xhr) => {
      try {
        xhr.abort();
      } catch {
        // Ignore
      }
    });
    xhrSetRef.current.clear();

    if (monitorTimerRef.current !== null) {
      window.clearTimeout(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setIsMonitoring(false);
    setTransferProgress(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  const cancelTest = useCallback(() => {
    stopAll();
    setPhase('idle');
    setProgressPct(0);
    setLiveSpeedMbps(0);
    setLivePingMs(null);
    setLiveJitterMs(null);
    setLiveDownloadMbps(null);
    setLiveUploadMbps(null);
    setLiveLoadedPingMs(null);
    setLiveDownloadLoadedPingMs(null);
    setLiveUploadLoadedPingMs(null);
    setLivePacketLossPct(0);
    setElapsedSeconds(0);
    setEstimatedRemainingSeconds(null);
  }, [stopAll]);

  const startPrecisionTest = useCallback(
    async (options?: PrecisionTestOptions) => {
      stopAll();
      const controller = new AbortController();
      abortRef.current = controller;
      const {signal} = controller;

      const isFileMode =
        options?.mode === 'file' &&
        typeof options.downloadBytes === 'number' &&
        options.downloadBytes > 0 &&
        typeof options.uploadBytes === 'number' &&
        options.uploadBytes > 0;

      const targetDlBytes = isFileMode ? options!.downloadBytes! : 0;
      const targetUlBytes = isFileMode ? options!.uploadBytes! : 0;
      const expectedDlMbps =
        options?.expectedDownloadMbps && options.expectedDownloadMbps > 0
          ? options.expectedDownloadMbps
          : null;
      const expectedUlMbps =
        options?.expectedUploadMbps && options.expectedUploadMbps > 0
          ? options.expectedUploadMbps
          : expectedDlMbps;

      const dlDurationMs = 6000;
      const ulDurationMs = 5000;

      const initialEtaSec = isFileMode
        ? expectedDlMbps
          ? 1.5 +
            (targetDlBytes * 8) / (expectedDlMbps * 1_000_000) +
            (targetUlBytes * 8) / ((expectedUlMbps ?? expectedDlMbps) * 1_000_000)
          : null
        : 1.5 + (dlDurationMs + ulDurationMs) / 1000;

      setErrorMessage(null);
      setPhase('ping');
      setProgressPct(4);
      setLiveSpeedMbps(0);
      setLivePingMs(null);
      setLiveJitterMs(null);
      setLiveDownloadMbps(null);
      setLiveUploadMbps(null);
      setLiveLoadedPingMs(null);
      setLiveDownloadLoadedPingMs(null);
      setLiveUploadLoadedPingMs(null);
      setLivePacketLossPct(0);
      setTransferProgress(null);
      setElapsedSeconds(0);
      setEstimatedRemainingSeconds(initialEtaSec);
      setSamples([]);

      const testStart = performance.now();
      const recordedSamples: TelemetrySample[] = [];

      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedSeconds((performance.now() - testStart) / 1000);
      }, 200);

      try {
        // Phase 1: Latency, Jitter & Packet Loss (10 probes)
        const pingTotal = 10;
        const pingValues: number[] = [];
        let failedPings = 0;

        const activeNodeId = effectiveNode?.id ?? 'local';
        for (let i = 0; i < pingTotal; i++) {
          if (signal.aborted) return null;
          const pStart = performance.now();
          try {
            const res = await fetch(
              `/api/speedtest/ping?seq=${i}&node=${encodeURIComponent(activeNodeId)}&t=${Date.now()}`,
              {cache: 'no-store', signal},
            );
            if (!res.ok) throw new Error('Ping failed');
            await res.json();
            const rtt = performance.now() - pStart;
            if (i > 0) {
              pingValues.push(rtt);
            }
            const currentMed = median(pingValues.length > 0 ? pingValues : [rtt]);
            setLivePingMs(currentMed);
            setLiveJitterMs(computeJitter(pingValues));

            const pt: TelemetrySample = {
              t: Number(((performance.now() - testStart) / 1000).toFixed(2)),
              downloadMbps: null,
              uploadMbps: null,
              pingMs: Number(rtt.toFixed(1)),
            };
            recordedSamples.push(pt);
            setSamples([...recordedSamples]);
          } catch {
            if (signal.aborted) return null;
            failedPings += 1;
          }
          setProgressPct(4 + Math.round(((i + 1) / pingTotal) * 14));
          const pingElapsed = (performance.now() - testStart) / 1000;
          const estPingRemain =
            ((pingTotal - (i + 1)) / Math.max(1, i + 1)) * pingElapsed;
          if (isFileMode) {
            if (expectedDlMbps) {
              const dlEst = (targetDlBytes * 8) / (expectedDlMbps * 1_000_000);
              const ulEst =
                (targetUlBytes * 8) /
                ((expectedUlMbps ?? expectedDlMbps) * 1_000_000);
              setEstimatedRemainingSeconds(Math.max(0, estPingRemain + dlEst + ulEst));
            }
          } else {
            setEstimatedRemainingSeconds(
              Math.max(0, estPingRemain + (dlDurationMs + ulDurationMs) / 1000),
            );
          }
        }

        const unloadedPing = pingValues.length > 0 ? median(pingValues) : 25;
        const jitter = computeJitter(pingValues);
        const packetLossPct = Number(((failedPings / pingTotal) * 100).toFixed(1));
        setLivePingMs(unloadedPing);
        setLiveJitterMs(jitter);
        setLivePacketLossPct(packetLossPct);

        // Phase 2: Multi-stream Download (timed window OR exact subscription file payload)
        setPhase('download');
        setLiveSpeedMbps(0);
        setLiveDownloadMbps(0);
        const dlRampSkipMs = 600;
        const dlStart = performance.now();
        let dlTotalBytes = 0;
        let dlSteadyBytes = 0;
        let dlSteadyStart = 0;
        let dlRemainingToAssign = targetDlBytes;
        let dlFinished = false;
        const loadedPings: number[] = [];
        const dlWindowBuckets: Array<{time: number; bytes: number}> = [];

        if (isFileMode) {
          setTransferProgress({bytes: 0, targetBytes: targetDlBytes});
        }

        const runDownloadWorker = async () => {
          while (!signal.aborted) {
            if (isFileMode) {
              if (dlRemainingToAssign <= 0) break;
            } else if (performance.now() - dlStart >= dlDurationMs) {
              break;
            }

            const chunkBytes = isFileMode
              ? Math.min(16 * 1024 * 1024, dlRemainingToAssign)
              : 12 * 1024 * 1024;
            if (isFileMode) {
              dlRemainingToAssign -= chunkBytes;
              if (chunkBytes <= 0) break;
            }

            try {
              const res = await fetch(
                `/api/speedtest/download?bytes=${chunkBytes}&t=${Date.now()}_${Math.random()}`,
                {cache: 'no-store', signal},
              );
              if (!res.body) break;
              const reader = res.body.getReader();
              while (!signal.aborted) {
                const {done, value} = await reader.read();
                if (done) break;
                const now = performance.now();
                const len = value.byteLength;
                dlTotalBytes += len;
                dlWindowBuckets.push({time: now, bytes: len});

                if (now - dlStart >= dlRampSkipMs) {
                  if (dlSteadyStart === 0) dlSteadyStart = now;
                  dlSteadyBytes += len;
                }

                if (!isFileMode && now - dlStart >= dlDurationMs) {
                  await reader.cancel().catch(() => {});
                  break;
                }
              }
            } catch {
              if (signal.aborted) return;
              break;
            }
          }
        };

        const runLoadedPingProbe = async () => {
          while (
            !signal.aborted &&
            !dlFinished &&
            (isFileMode || performance.now() - dlStart < dlDurationMs)
          ) {
            await new Promise((r) => setTimeout(r, 700));
            if (
              signal.aborted ||
              dlFinished ||
              (!isFileMode && performance.now() - dlStart >= dlDurationMs)
            ) {
              break;
            }
            const p0 = performance.now();
            try {
              await fetch(
                `/api/speedtest/ping?loaded=dl&node=${encodeURIComponent(effectiveNode?.id ?? 'local')}&t=${Date.now()}`,
                {
                  cache: 'no-store',
                  signal,
                },
              );
              const rtt = performance.now() - p0;
              loadedPings.push(rtt);
              const dlMed = median(loadedPings);
              setLiveDownloadLoadedPingMs(dlMed);
              setLiveLoadedPingMs(dlMed);
            } catch {
              // Ignore aborted probes
            }
          }
        };

        const dlSampler = window.setInterval(() => {
          const now = performance.now();
          const elapsed = now - dlStart;
          const windowCutoff = now - 1000;
          let windowBytes = 0;
          while (dlWindowBuckets.length > 0 && dlWindowBuckets[0].time < windowCutoff) {
            dlWindowBuckets.shift();
          }
          for (const b of dlWindowBuckets) windowBytes += b.bytes;

          const spanSec = Math.max(0.25, Math.min(1.0, elapsed / 1000));
          const instMbps = (windowBytes * 8) / (spanSec * 1e6);
          setLiveSpeedMbps(instMbps);
          setLiveDownloadMbps(instMbps);

          if (isFileMode) {
            setTransferProgress({
              bytes: Math.min(targetDlBytes, dlTotalBytes),
              targetBytes: targetDlBytes,
            });
            const ratio = Math.min(1, dlTotalBytes / Math.max(1, targetDlBytes));
            setProgressPct(18 + Math.round(ratio * 40));

            const elapsedSec = elapsed / 1000;
            const avgDlBps =
              elapsedSec > 0.35 && dlTotalBytes > 0
                ? dlTotalBytes / elapsedSec
                : expectedDlMbps
                  ? (expectedDlMbps * 1_000_000) / 8
                  : 0;
            if (avgDlBps > 0) {
              const dlRemSec = Math.max(0, (targetDlBytes - dlTotalBytes) / avgDlBps);
              const ulBpsEst = expectedUlMbps
                ? (expectedUlMbps * 1_000_000) / 8
                : avgDlBps * 0.6;
              const ulEstSec = ulBpsEst > 0 ? targetUlBytes / ulBpsEst : 0;
              setEstimatedRemainingSeconds(Math.max(0, dlRemSec + ulEstSec));
            }
          } else {
            setProgressPct(18 + Math.min(40, Math.round((elapsed / dlDurationMs) * 40)));
            const dlRemSec = Math.max(0, (dlDurationMs - elapsed) / 1000);
            setEstimatedRemainingSeconds(dlRemSec + ulDurationMs / 1000);
          }

          recordedSamples.push({
            t: Number(((now - testStart) / 1000).toFixed(2)),
            downloadMbps: Number(instMbps.toFixed(2)),
            uploadMbps: null,
            pingMs:
              loadedPings.length > 0
                ? Number(loadedPings[loadedPings.length - 1].toFixed(1))
                : null,
          });
          setSamples([...recordedSamples]);
        }, 200);

        const dlWorkers = Array.from({length: recommendedStreams}, () =>
          runDownloadWorker(),
        );

        if (isFileMode) {
          await Promise.all([
            Promise.all(dlWorkers).then(() => {
              dlFinished = true;
            }),
            runLoadedPingProbe(),
          ]);
        } else {
          await Promise.race([
            Promise.all([...dlWorkers, runLoadedPingProbe()]),
            new Promise<void>((resolve) => {
              const check = window.setInterval(() => {
                if (signal.aborted || performance.now() - dlStart >= dlDurationMs + 250) {
                  window.clearInterval(check);
                  resolve();
                }
              }, 100);
            }),
          ]);
          dlFinished = true;
        }

        window.clearInterval(dlSampler);
        if (signal.aborted) return null;

        const totalDlSec = Math.max(0.4, (performance.now() - dlStart) / 1000);
        const steadyDlSec = Math.max(
          0.5,
          ((dlSteadyStart > 0 ? performance.now() - dlSteadyStart : performance.now() - dlStart)) /
            1000,
        );
        const finalDownloadMbps = isFileMode
          ? (dlTotalBytes * 8) / (totalDlSec * 1e6)
          : dlSteadyBytes > 0
            ? (dlSteadyBytes * 8) / (steadyDlSec * 1e6)
            : (dlTotalBytes * 8) / (totalDlSec * 1e6);

        setLiveDownloadMbps(finalDownloadMbps);
        const dlLoadedPing =
          loadedPings.length > 0 ? median(loadedPings) : unloadedPing;
        setLiveDownloadLoadedPingMs(dlLoadedPing);
        setLiveLoadedPingMs(dlLoadedPing);

        // Phase 3: Multi-stream Upload (timed window OR exact subscription file payload)
        setPhase('upload');
        setLiveSpeedMbps(0);
        setLiveUploadMbps(0);
        const ulRampSkipMs = 600;
        const ulStart = performance.now();
        let ulTotalBytes = 0;
        let ulSteadyBytes = 0;
        let ulSteadyStart = 0;
        let ulRemainingToAssign = targetUlBytes;
        let ulFinished = false;
        const ulLoadedPings: number[] = [];
        const ulWindowBuckets: Array<{time: number; bytes: number}> = [];
        const chunkPayloadBytes = isFileMode ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
        const uploadPayload = createUploadPayload(chunkPayloadBytes);

        if (isFileMode) {
          setTransferProgress({bytes: 0, targetBytes: targetUlBytes});
        }

        const runUploadWorker = async () => {
          while (!signal.aborted) {
            if (isFileMode) {
              if (ulRemainingToAssign <= 0) break;
            } else if (performance.now() - ulStart >= ulDurationMs) {
              break;
            }

            const sendLen = isFileMode
              ? Math.min(chunkPayloadBytes, ulRemainingToAssign)
              : chunkPayloadBytes;
            if (isFileMode) {
              ulRemainingToAssign -= sendLen;
              if (sendLen <= 0) break;
            }

            const bodySlice =
              sendLen === uploadPayload.byteLength
                ? uploadPayload
                : uploadPayload.subarray(0, sendLen);

            await new Promise<void>((resolve) => {
              const xhr = new XMLHttpRequest();
              xhrSetRef.current.add(xhr);
              let lastLoaded = 0;

              xhr.open('POST', `/api/speedtest/upload?t=${Date.now()}_${Math.random()}`, true);
              xhr.setRequestHeader('Content-Type', 'application/octet-stream');

              xhr.upload.onprogress = (ev) => {
                const now = performance.now();
                const delta = Math.max(0, ev.loaded - lastLoaded);
                lastLoaded = ev.loaded;
                ulTotalBytes += delta;
                ulWindowBuckets.push({time: now, bytes: delta});

                if (now - ulStart >= ulRampSkipMs) {
                  if (ulSteadyStart === 0) ulSteadyStart = now;
                  ulSteadyBytes += delta;
                }
                if (!isFileMode && now - ulStart >= ulDurationMs) {
                  xhr.abort();
                }
              };

              xhr.onloadend = () => {
                xhrSetRef.current.delete(xhr);
                resolve();
              };

              xhr.onerror = () => {
                xhrSetRef.current.delete(xhr);
                resolve();
              };

              xhr.send(bodySlice as unknown as XMLHttpRequestBodyInit);
            });
          }
        };

        const runUploadLoadedPingProbe = async () => {
          while (
            !signal.aborted &&
            !ulFinished &&
            (isFileMode || performance.now() - ulStart < ulDurationMs)
          ) {
            await new Promise((r) => setTimeout(r, 700));
            if (
              signal.aborted ||
              ulFinished ||
              (!isFileMode && performance.now() - ulStart >= ulDurationMs)
            ) {
              break;
            }
            const p0 = performance.now();
            try {
              await fetch(
                `/api/speedtest/ping?loaded=ul&node=${encodeURIComponent(effectiveNode?.id ?? 'local')}&t=${Date.now()}`,
                {
                  cache: 'no-store',
                  signal,
                },
              );
              const rtt = performance.now() - p0;
              ulLoadedPings.push(rtt);
              const ulMed = median(ulLoadedPings);
              const allMed = median([...loadedPings, ...ulLoadedPings]);
              setLiveUploadLoadedPingMs(ulMed);
              setLiveLoadedPingMs(allMed);
            } catch {
              // Ignore aborted probes
            }
          }
        };

        const ulSampler = window.setInterval(() => {
          const now = performance.now();
          const elapsed = now - ulStart;
          const windowCutoff = now - 1000;
          let windowBytes = 0;
          while (ulWindowBuckets.length > 0 && ulWindowBuckets[0].time < windowCutoff) {
            ulWindowBuckets.shift();
          }
          for (const b of ulWindowBuckets) windowBytes += b.bytes;

          const spanSec = Math.max(0.25, Math.min(1.0, elapsed / 1000));
          const instMbps = (windowBytes * 8) / (spanSec * 1e6);
          setLiveSpeedMbps(instMbps);
          setLiveUploadMbps(instMbps);

          if (isFileMode) {
            setTransferProgress({
              bytes: Math.min(targetUlBytes, ulTotalBytes),
              targetBytes: targetUlBytes,
            });
            const ratio = Math.min(1, ulTotalBytes / Math.max(1, targetUlBytes));
            setProgressPct(58 + Math.round(ratio * 40));

            const elapsedSec = elapsed / 1000;
            const avgUlBps =
              elapsedSec > 0.35 && ulTotalBytes > 0
                ? ulTotalBytes / elapsedSec
                : expectedUlMbps
                  ? (expectedUlMbps * 1_000_000) / 8
                  : (finalDownloadMbps * 1_000_000) / 16;
            if (avgUlBps > 0) {
              const ulRemSec = Math.max(0, (targetUlBytes - ulTotalBytes) / avgUlBps);
              setEstimatedRemainingSeconds(Math.max(0, ulRemSec));
            }
          } else {
            setProgressPct(58 + Math.min(40, Math.round((elapsed / ulDurationMs) * 40)));
            setEstimatedRemainingSeconds(Math.max(0, (ulDurationMs - elapsed) / 1000));
          }

          recordedSamples.push({
            t: Number(((now - testStart) / 1000).toFixed(2)),
            downloadMbps: null,
            uploadMbps: Number(instMbps.toFixed(2)),
            pingMs:
              ulLoadedPings.length > 0
                ? Number(ulLoadedPings[ulLoadedPings.length - 1].toFixed(1))
                : null,
          });
          setSamples([...recordedSamples]);
        }, 200);

        const ulWorkers = Array.from(
          {length: Math.max(2, Math.min(3, recommendedStreams))},
          () => runUploadWorker(),
        );
        await Promise.all([
          Promise.all(ulWorkers).then(() => {
            ulFinished = true;
          }),
          runUploadLoadedPingProbe(),
        ]);
        window.clearInterval(ulSampler);
        if (signal.aborted) return null;

        const totalUlSec = Math.max(0.4, (performance.now() - ulStart) / 1000);
        const steadyUlSec = Math.max(
          0.5,
          ((ulSteadyStart > 0 ? performance.now() - ulSteadyStart : performance.now() - ulStart)) /
            1000,
        );
        const finalUploadMbps = isFileMode
          ? (ulTotalBytes * 8) / (totalUlSec * 1e6)
          : ulSteadyBytes > 0
            ? (ulSteadyBytes * 8) / (steadyUlSec * 1e6)
            : (ulTotalBytes * 8) / (totalUlSec * 1e6);

        const ulLoadedPing =
          ulLoadedPings.length > 0 ? median(ulLoadedPings) : dlLoadedPing;
        const combinedLoadedSamples = [...loadedPings, ...ulLoadedPings];
        const loadedPing =
          combinedLoadedSamples.length > 0
            ? median(combinedLoadedSamples)
            : unloadedPing;

        const totalDurationSec = Number(
          ((performance.now() - testStart) / 1000).toFixed(1),
        );
        if (elapsedTimerRef.current !== null) {
          window.clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
        setElapsedSeconds(totalDurationSec);
        setEstimatedRemainingSeconds(0);
        setLiveUploadMbps(finalUploadMbps);
        setLiveUploadLoadedPingMs(ulLoadedPing);
        setLiveLoadedPingMs(loadedPing);
        setLiveSpeedMbps((finalDownloadMbps + finalUploadMbps) / 2);
        setProgressPct(100);
        setTransferProgress(null);

        const score = calculateVeloxisScore({
          downloadMbps: finalDownloadMbps,
          uploadMbps: finalUploadMbps,
          pingMs: unloadedPing,
          loadedPingMs: loadedPing,
          jitterMs: jitter,
          packetLossPct,
        });

        const activities = evaluateActivities({
          downloadMbps: finalDownloadMbps,
          uploadMbps: finalUploadMbps,
          pingMs: unloadedPing,
          loadedPingMs: loadedPing,
          jitterMs: jitter,
          packetLossPct,
        });

        const bloat = evaluateBufferbloat(unloadedPing, loadedPing);
        const result: SpeedTestResult = {
          id: `vx_${Date.now()}`,
          timestamp: new Date().toISOString(),
          mode: isFileMode ? 'file' : 'precision',
          downloadMbps: Number(finalDownloadMbps.toFixed(2)),
          uploadMbps: Number(finalUploadMbps.toFixed(2)),
          pingMs: Number(unloadedPing.toFixed(1)),
          loadedPingMs: Number(loadedPing.toFixed(1)),
          downloadLoadedPingMs: Number(dlLoadedPing.toFixed(1)),
          uploadLoadedPingMs: Number(ulLoadedPing.toFixed(1)),
          jitterMs: Number(jitter.toFixed(1)),
          packetLossPct,
          veloxisScore: score,
          bufferbloatGrade: bloat.grade,
          activities,
          network: {
            ...networkInfo,
            serverNode: effectiveNode?.label ?? networkInfo.serverNode,
          },
          testLocation: calibratedLocation
            ? {
                lat: Number(calibratedLocation.lat.toFixed(2)),
                lon: Number(calibratedLocation.lon.toFixed(2)),
                city: calibratedLocation.city,
                region: calibratedLocation.region,
                country: calibratedLocation.country,
                countryCode: calibratedLocation.countryCode,
                accuracyKm: calibratedLocation.accuracyKm ?? 2,
              }
            : undefined,
          samples: recordedSamples,
          durationSec: totalDurationSec,
          transferredBytes: isFileMode
            ? {download: dlTotalBytes, upload: ulTotalBytes}
            : undefined,
        };

        sessionBytesDownRef.current += dlTotalBytes;
        sessionBytesUpRef.current += ulTotalBytes;

        setLatestResult(result);
        setHistory((prev) => {
          const next = [result, ...prev].slice(0, 50);
          saveHistory(next);
          return next;
        });
        setPhase('complete');
        syncDevices({
          dlMbps: result.downloadMbps,
          ulMbps: result.uploadMbps,
          rttMs: result.pingMs,
          testing: false,
        });
        return result;
      } catch {
        if (elapsedTimerRef.current !== null) {
          window.clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
        if (!signal.aborted) {
          setTransferProgress(null);
          setEstimatedRemainingSeconds(null);
          setErrorMessage(
            'Unable to complete speed measurement. Check your connection and try again.',
          );
          setPhase('error');
        }
        return null;
      }
    },
    [
      calibratedLocation,
      effectiveNode?.id,
      effectiveNode?.label,
      networkInfo,
      recommendedStreams,
      stopAll,
      syncDevices,
    ],
  );

  const startRealtimeMonitor = useCallback(() => {
    stopAll();
    const controller = new AbortController();
    abortRef.current = controller;
    const {signal} = controller;

    setErrorMessage(null);
    setIsMonitoring(true);
    setPhase('monitoring');
    setMonitorSamples([]);

    const monitorStart = performance.now();
    const pingHistory: number[] = [];
    let lastDlMbps = latestResult?.downloadMbps ?? 0;
    let tickCount = 0;

    const tick = async () => {
      if (signal.aborted) return;
      tickCount += 1;

      const p0 = performance.now();
      let pingVal: number | null = null;
      try {
        await fetch(`/api/speedtest/ping?rt=${tickCount}&t=${Date.now()}`, {
          cache: 'no-store',
          signal,
        });
        pingVal = performance.now() - p0;
        pingHistory.push(pingVal);
        if (pingHistory.length > 30) pingHistory.shift();
        setLivePingMs(median(pingHistory));
        setLiveJitterMs(computeJitter(pingHistory));
      } catch {
        if (signal.aborted) return;
      }

      let dlSample: number | null = null;
      if (tickCount === 1 || tickCount % 3 === 0) {
        const burstBytes = lastDlMbps > 50 ? 2 * 1024 * 1024 : 768 * 1024;
        const d0 = performance.now();
        try {
          const res = await fetch(
            `/api/speedtest/download?bytes=${burstBytes}&rt=${tickCount}&t=${Date.now()}`,
            {cache: 'no-store', signal},
          );
          const buf = await res.arrayBuffer();
          sessionBytesDownRef.current += buf.byteLength;
          const sec = Math.max(0.03, (performance.now() - d0) / 1000);
          dlSample = (buf.byteLength * 8) / (sec * 1e6);
          lastDlMbps = dlSample;
          setLiveDownloadMbps(dlSample);
          setLiveSpeedMbps(dlSample);
          syncDevices({
            dlMbps: dlSample,
            rttMs: pingVal ?? undefined,
            testing: true,
          });
        } catch {
          if (signal.aborted) return;
        }
      }

      const point: TelemetrySample = {
        t: Number(((performance.now() - monitorStart) / 1000).toFixed(1)),
        downloadMbps: dlSample !== null ? Number(dlSample.toFixed(2)) : null,
        uploadMbps: null,
        pingMs: pingVal !== null ? Number(pingVal.toFixed(1)) : null,
      };

      setMonitorSamples((prev) => [...prev.slice(-44), point]);

      if (!signal.aborted) {
        monitorTimerRef.current = window.setTimeout(tick, 1100);
      }
    };

    tick();
  }, [latestResult?.downloadMbps, stopAll, syncDevices]);

  const stopRealtimeMonitor = useCallback(() => {
    stopAll();
    setPhase(latestResult ? 'complete' : 'idle');
  }, [latestResult, stopAll]);

  const saveMonitorSnapshot = useCallback(() => {
    const dlPoints = monitorSamples
      .map((s) => s.downloadMbps)
      .filter((v): v is number => v !== null);
    const pingPoints = monitorSamples
      .map((s) => s.pingMs)
      .filter((v): v is number => v !== null);

    if (dlPoints.length === 0 && pingPoints.length === 0) return null;

    const avgDl =
      dlPoints.length > 0
        ? dlPoints.reduce((a, b) => a + b, 0) / dlPoints.length
        : latestResult?.downloadMbps ?? 0;
    const recordedUl = latestResult?.uploadMbps ?? 0;
    const medPing = pingPoints.length > 0 ? median(pingPoints) : 20;
    const jit = computeJitter(pingPoints);

    const score = calculateVeloxisScore({
      downloadMbps: avgDl,
      uploadMbps: recordedUl,
      pingMs: medPing,
      loadedPingMs: medPing + jit,
      jitterMs: jit,
      packetLossPct: 0,
    });

    const snapshot: SpeedTestResult = {
      id: `vx_rt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: 'realtime',
      downloadMbps: Number(avgDl.toFixed(2)),
      uploadMbps: Number(recordedUl.toFixed(2)),
      pingMs: Number(medPing.toFixed(1)),
      loadedPingMs: Number((medPing + jit).toFixed(1)),
      jitterMs: Number(jit.toFixed(1)),
      packetLossPct: 0,
      veloxisScore: score,
      bufferbloatGrade: evaluateBufferbloat(medPing, medPing + jit).grade,
      activities: evaluateActivities({
        downloadMbps: avgDl,
        uploadMbps: recordedUl,
        pingMs: medPing,
        loadedPingMs: medPing + jit,
        jitterMs: jit,
        packetLossPct: 0,
      }),
      network: {
        ...networkInfo,
        serverNode: effectiveNode?.label ?? networkInfo.serverNode,
      },
      testLocation: calibratedLocation
        ? {
            lat: Number(calibratedLocation.lat.toFixed(2)),
            lon: Number(calibratedLocation.lon.toFixed(2)),
            city: calibratedLocation.city,
            region: calibratedLocation.region,
            country: calibratedLocation.country,
            countryCode: calibratedLocation.countryCode,
            accuracyKm: calibratedLocation.accuracyKm ?? 2,
          }
        : undefined,
      samples: monitorSamples,
    };

    setLatestResult(snapshot);
    setHistory((prev) => {
      const next = [snapshot, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
    return snapshot;
  }, [
    calibratedLocation,
    effectiveNode?.label,
    latestResult?.downloadMbps,
    latestResult?.uploadMbps,
    monitorSamples,
    networkInfo,
  ]);

  const mergeRemoteHistory = useCallback((remoteRuns: SpeedTestResult[]) => {
    setHistory((prev) => {
      const byId = new Map<string, SpeedTestResult>();
      for (const item of prev) byId.set(item.id, item);
      for (const item of remoteRuns) {
        const existing = byId.get(item.id);
        byId.set(item.id, existing ? {...item, samples: existing.samples} : item);
      }
      const merged = Array.from(byId.values())
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 50);
      saveHistory(merged);
      return merged;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    phase,
    progressPct,
    liveSpeedMbps,
    livePingMs,
    liveJitterMs,
    liveDownloadMbps,
    liveUploadMbps,
    liveLoadedPingMs,
    liveDownloadLoadedPingMs,
    liveUploadLoadedPingMs,
    livePacketLossPct,
    transferProgress,
    elapsedSeconds,
    estimatedRemainingSeconds,
    samples,
    latestResult,
    history,
    networkInfo,
    regionalIsps,
    browserHint,
    detectedDevices,
    edgeNodes: calibratedEdgeNodes,
    selectedNodeId,
    effectiveNode,
    isProbingNodes,
    errorMessage,
    isMonitoring,
    monitorSamples,
    startPrecisionTest,
    cancelTest,
    startRealtimeMonitor,
    stopRealtimeMonitor,
    saveMonitorSnapshot,
    clearHistory,
    mergeRemoteHistory,
    refreshNetworkInfo,
    setSelectedNodeId,
    probeEdgeNodes,
  };
}
