import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  BookmarkPlus,
  Check,
  Copy,
  Download,
  HardDriveDownload,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import {AnimatePresence, MotionConfig, motion} from 'motion/react';
import {ActivityDiagnostics} from './components/ActivityDiagnostics';
import {AdSlot} from './components/AdSlot';
import {AnimatedNumber} from './components/AnimatedNumber';
import {AppNav, type PageAnchor} from './components/AppNav';
import {DevicePlanBenchmark} from './components/DevicePlanBenchmark';
import {EdgeNodeSelector} from './components/EdgeNodeSelector';
import {ErrorBoundary} from './components/ErrorBoundary';
import {HistoryTrendsChart} from './components/HistoryTrendsChart';
import {HistoryView} from './components/HistoryView';
import {InstallExtensionModal} from './components/InstallExtensionModal';
import {PrecisionGauge} from './components/PrecisionGauge';
import {ReliabilityWatchCard} from './components/ReliabilityWatchCard';
import {TelemetryWaveform} from './components/TelemetryWaveform';
import {TransferAlertModal} from './components/TransferAlertModal';
import {useAdConsent} from './hooks/useAdConsent';
import {useCloudSync} from './hooks/useCloudSync';
import {useKeyboardShortcuts} from './hooks/useKeyboardShortcuts';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {usePWAInstall} from './hooks/usePWAInstall';
import {useSpeedTest} from './hooks/useSpeedTest';
import {useSystemTheme} from './hooks/useSystemTheme';
import {useTelemetryAudio} from './hooks/useTelemetryAudio';
import type {
  BenchmarkProfile,
  DetectedDevice,
  SpeedUnit,
  TestMode,
  TestPhase,
} from './types/speedtest';
import {
  computeSubscriptionTransferBytes,
  convertSpeed,
  estimateTestDurationSec,
  formatDuration,
  formatSpeedValue,
  formatTransferSize,
  getScoreLabel,
} from './utils/scoring';
import {
  downloadResultReportPng,
  formatResultSummaryText,
} from './utils/shareReport';

const PROFILE_STORAGE_KEY = 'veloxis_benchmark_profile_v2';
const UNIT_STORAGE_KEY = 'veloxis_speed_unit_v1';
const WATCH_INTERVAL_KEY = 'veloxis_watch_interval_min_v1';
const WATCH_THRESHOLD_KEY = 'veloxis_watch_threshold_pct_v1';

const DEFAULT_PROFILE: BenchmarkProfile = {
  planName: '',
  subscribedDownloadMbps: null,
  subscribedUploadMbps: null,
  monthlyPrice: null,
  currencyCode: '',
};

function loadProfile(): BenchmarkProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return {...DEFAULT_PROFILE, ...JSON.parse(raw)};
  } catch {
    return DEFAULT_PROFILE;
  }
}

function loadSpeedUnit(): SpeedUnit {
  try {
    const raw = localStorage.getItem(UNIT_STORAGE_KEY);
    return raw === 'MBps' ? 'MBps' : 'Mbps';
  } catch {
    return 'Mbps';
  }
}

function loadWatchNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeAnchor, setActiveAnchor] = useState<PageAnchor>('console');
  const [consoleMode, setConsoleMode] = useState<TestMode>('precision');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferAlertOpen, setIsTransferAlertOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<BenchmarkProfile>(loadProfile);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>(loadSpeedUnit);
  const [watchIntervalMin, setWatchIntervalMin] = useState<number>(() =>
    loadWatchNumber(WATCH_INTERVAL_KEY, 0),
  );
  const [watchThresholdPct, setWatchThresholdPct] = useState<number>(() =>
    loadWatchNumber(WATCH_THRESHOLD_KEY, 70),
  );
  const [watchCountdownSec, setWatchCountdownSec] = useState<number | null>(null);
  const [watchRunsCount, setWatchRunsCount] = useState(0);
  const [watchAlertsCount, setWatchAlertsCount] = useState(0);
  const [watchAlertMessage, setWatchAlertMessage] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [remoteCloudDevices, setRemoteCloudDevices] = useState<DetectedDevice[]>([]);

  const {isDark} = useSystemTheme();
  const isOnline = useOnlineStatus();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const {resetConsent} = useAdConsent();

  const {
    phase,
    progressPct,
    liveSpeedMbps,
    livePingMs,
    liveJitterMs,
    liveDownloadMbps,
    liveUploadMbps,
    liveLoadedPingMs,
    livePacketLossPct,
    transferProgress,
    elapsedSeconds,
    estimatedRemainingSeconds,
    samples,
    latestResult,
    history,
    networkInfo,
    regionalIsps,
    detectedDevices,
    edgeNodes,
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
  } = useSpeedTest();

  const skipSyncPushRef = useRef(false);

  const {
    user: cloudUser,
    authLoading,
    authError,
    signInWithGoogle,
    signOutUser,
    pushTestRunToCloud,
    pushSettingsToCloud,
    pushDeviceToCloud,
    broadcastHistoryCleared,
  } = useCloudSync({
    onReceiveRemoteTests: mergeRemoteHistory,
    onReceiveRemoteSettings: (settings) => {
      skipSyncPushRef.current = true;
      if (settings.profile) {
        setProfile((prev) => ({...prev, ...settings.profile}));
      }
      if (settings.speedUnit) {
        setSpeedUnit(settings.speedUnit);
      }
      if (typeof settings.watchIntervalMin === 'number') {
        setWatchIntervalMin(settings.watchIntervalMin);
      }
      if (typeof settings.watchThresholdPct === 'number') {
        setWatchThresholdPct(settings.watchThresholdPct);
      }
      window.setTimeout(() => {
        skipSyncPushRef.current = false;
      }, 150);
    },
    onReceiveRemoteDevices: setRemoteCloudDevices,
    onLocalTabTest: (test) => mergeRemoteHistory([test]),
    onLocalTabHistoryCleared: clearHistory,
  });

  const {
    isMuted,
    toggleMute,
    playStart,
    playPhaseTransition,
    playProgressTick,
    playComplete,
    playCancel,
  } = useTelemetryAudio();

  const prevPhaseRef = useRef<TestPhase>(phase);
  const lastProgressBucketRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      if (phase === 'download' || phase === 'upload') {
        playPhaseTransition(phase);
      } else if (
        phase === 'complete' &&
        (prev === 'upload' || prev === 'download' || prev === 'ping')
      ) {
        playComplete();
      } else if (phase === 'error') {
        playCancel();
      }
      if (phase === 'ping' || phase === 'idle') {
        lastProgressBucketRef.current = 0;
      }
      prevPhaseRef.current = phase;
    }
  }, [phase, playCancel, playComplete, playPhaseTransition]);

  useEffect(() => {
    if (phase !== 'download' && phase !== 'upload') return;
    const bucket = Math.floor(progressPct / 15);
    if (bucket > lastProgressBucketRef.current && progressPct < 98) {
      lastProgressBucketRef.current = bucket;
      playProgressTick(progressPct);
    }
  }, [phase, progressPct, playProgressTick]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, speedUnit);
    } catch {
      // Ignore storage quota errors
    }
  }, [speedUnit]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCH_INTERVAL_KEY, String(watchIntervalMin));
      localStorage.setItem(WATCH_THRESHOLD_KEY, String(watchThresholdPct));
    } catch {
      // Ignore storage quota errors
    }
  }, [watchIntervalMin, watchThresholdPct]);

  useEffect(() => {
    if (skipSyncPushRef.current) return;
    void pushSettingsToCloud({
      profile,
      speedUnit,
      watchIntervalMin,
      watchThresholdPct,
    });
  }, [
    profile,
    pushSettingsToCloud,
    speedUnit,
    watchIntervalMin,
    watchThresholdPct,
  ]);

  useEffect(() => {
    if (!cloudUser) return;
    const currentDev = detectedDevices.find((d) => d.isCurrentDevice);
    if (currentDev) {
      void pushDeviceToCloud(currentDev);
    }
  }, [cloudUser, detectedDevices, pushDeviceToCloud]);

  const mergedDevices = useMemo(() => {
    const byId = new Map<string, DetectedDevice>();
    for (const remote of remoteCloudDevices) {
      byId.set(remote.deviceId, remote);
    }
    for (const local of detectedDevices) {
      byId.set(local.deviceId, local);
    }
    return Array.from(byId.values());
  }, [detectedDevices, remoteCloudDevices]);

  const isTesting =
    phase === 'ping' ||
    phase === 'download' ||
    phase === 'upload' ||
    isMonitoring;

  const displayedDl =
    phase === 'idle' && latestResult
      ? latestResult.downloadMbps
      : liveDownloadMbps ?? latestResult?.downloadMbps ?? 0;

  const displayedUl =
    phase === 'idle' && latestResult
      ? latestResult.uploadMbps
      : liveUploadMbps ?? latestResult?.uploadMbps ?? 0;

  const displayedPing =
    phase === 'idle' && latestResult
      ? latestResult.pingMs
      : livePingMs ?? latestResult?.pingMs ?? null;

  const displayedLoadedPing =
    phase === 'idle' && latestResult
      ? latestResult.loadedPingMs
      : liveLoadedPingMs ?? latestResult?.loadedPingMs ?? null;

  const displayedJitter =
    phase === 'idle' && latestResult
      ? latestResult.jitterMs
      : liveJitterMs ?? latestResult?.jitterMs ?? null;

  const displayedLoss =
    phase === 'idle' && latestResult
      ? latestResult.packetLossPct
      : livePacketLossPct;

  const displayedScore = latestResult?.veloxisScore ?? null;
  const scoreMeta = displayedScore !== null ? getScoreLabel(displayedScore) : null;

  const dlDisplayVal =
    displayedDl > 0
      ? convertSpeed(displayedDl, speedUnit)
      : phase === 'download'
        ? 0
        : null;
  const ulDisplayVal =
    displayedUl > 0
      ? convertSpeed(displayedUl, speedUnit)
      : phase === 'upload'
        ? 0
        : null;
  const liveDlMonitorVal =
    liveDownloadMbps !== null ? convertSpeed(liveDownloadMbps, speedUnit) : null;
  const unitDecimals = speedUnit === 'MBps' ? 2 : 1;

  // Compute recommended file transfer payload from user's configured ISP plan
  const dlPlanVal =
    profile.subscribedDownloadMbps !== null
      ? convertSpeed(profile.subscribedDownloadMbps, speedUnit)
      : null;
  const ulPlanVal =
    profile.subscribedUploadMbps !== null
      ? convertSpeed(profile.subscribedUploadMbps, speedUnit)
      : null;
  const plannedDlBytes = computeSubscriptionTransferBytes(dlPlanVal);
  const plannedUlBytes =
    ulPlanVal !== null
      ? computeSubscriptionTransferBytes(ulPlanVal)
      : plannedDlBytes;

  const estimatedTotalSec = estimateTestDurationSec({
    mode: consoleMode,
    downloadBytes: plannedDlBytes,
    uploadBytes: plannedUlBytes,
    downloadMbps:
      profile.subscribedDownloadMbps ?? latestResult?.downloadMbps ?? null,
    uploadMbps:
      profile.subscribedUploadMbps ??
      profile.subscribedDownloadMbps ??
      latestResult?.uploadMbps ??
      null,
  });

  const lastDurationSec =
    phase === 'complete'
      ? (latestResult?.durationSec ?? elapsedSeconds)
      : (latestResult?.durationSec ?? null);

  const handleSelectConsoleMode = (nextMode: TestMode) => {
    if (isTesting) return;
    if (consoleMode === 'realtime' && nextMode !== 'realtime' && isMonitoring) {
      stopRealtimeMonitor();
    }
    setConsoleMode(nextMode);
  };

  const handleTriggerStart = useCallback(async () => {
    if (consoleMode === 'file') {
      setIsTransferAlertOpen(true);
      return;
    }
    lastProgressBucketRef.current = 0;
    playStart();
    const res = await startPrecisionTest({mode: 'precision'});
    if (res) {
      void pushTestRunToCloud(res);
    }
  }, [consoleMode, playStart, pushTestRunToCloud, startPrecisionTest]);

  const handleConfirmFileTest = useCallback(
    async (downloadBytes: number, uploadBytes: number) => {
      setConsoleMode('file');
      lastProgressBucketRef.current = 0;
      playStart();
      const res = await startPrecisionTest({
        mode: 'file',
        downloadBytes,
        uploadBytes,
        expectedDownloadMbps:
          profile.subscribedDownloadMbps ?? latestResult?.downloadMbps ?? null,
        expectedUploadMbps:
          profile.subscribedUploadMbps ??
          profile.subscribedDownloadMbps ??
          latestResult?.uploadMbps ??
          null,
      });
      if (res) {
        void pushTestRunToCloud(res);
      }
    },
    [
      latestResult?.downloadMbps,
      latestResult?.uploadMbps,
      playStart,
      profile.subscribedDownloadMbps,
      profile.subscribedUploadMbps,
      pushTestRunToCloud,
      startPrecisionTest,
    ],
  );

  const handleCancelTest = useCallback(() => {
    playCancel();
    cancelTest();
  }, [cancelTest, playCancel]);

  const handleSaveSnapshot = () => {
    const saved = saveMonitorSnapshot();
    if (saved) {
      void pushTestRunToCloud(saved);
      setSnapshotNotice(
        `Saved snapshot (${saved.downloadMbps.toFixed(1)} Mbps · Score ${saved.veloxisScore})`,
      );
      window.setTimeout(() => setSnapshotNotice(null), 3500);
    }
  };

  const handleOpenHistory = useCallback(() => {
    setActiveAnchor('history');
    setIsHistoryOpen(true);
    window.setTimeout(() => {
      const el = document.getElementById('history');
      if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 60);
  }, []);

  const handleCopyReport = async () => {
    if (!latestResult) return;
    try {
      await navigator.clipboard.writeText(
        formatResultSummaryText(latestResult, speedUnit),
      );
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    } else if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  };

  const runScheduledWatchTest = useCallback(async () => {
    if (isTesting || !isOnline) return;
    lastProgressBucketRef.current = 0;
    const res = await startPrecisionTest({mode: 'precision'});
    if (!res) return;
    void pushTestRunToCloud(res);
    setWatchRunsCount((c) => c + 1);

    if (
      profile.subscribedDownloadMbps &&
      profile.subscribedDownloadMbps > 0
    ) {
      const minExpectedMbps =
        (profile.subscribedDownloadMbps * watchThresholdPct) / 100;
      if (res.downloadMbps < minExpectedMbps) {
        const msg = `Scheduled watch alert: Measured ${formatSpeedValue(res.downloadMbps, speedUnit)} ${speedUnit} fell below ${watchThresholdPct}% of your plan (${formatSpeedValue(minExpectedMbps, speedUnit)} ${speedUnit}).`;
        setWatchAlertsCount((c) => c + 1);
        setWatchAlertMessage(msg);
        if (
          notificationsEnabled &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification('Veloxis Speed Drop Alert', {body: msg});
          } catch {
            // Ignore notification errors in restricted environments
          }
        }
      }
    }
  }, [
    isOnline,
    isTesting,
    notificationsEnabled,
    profile.subscribedDownloadMbps,
    pushTestRunToCloud,
    speedUnit,
    startPrecisionTest,
    watchThresholdPct,
  ]);

  const runWatchRef = useRef(runScheduledWatchTest);
  runWatchRef.current = runScheduledWatchTest;

  useEffect(() => {
    if (watchIntervalMin <= 0) {
      setWatchCountdownSec(null);
      return;
    }
    const intervalSec = watchIntervalMin * 60;
    setWatchCountdownSec(intervalSec);

    const timer = window.setInterval(() => {
      setWatchCountdownSec((prev) => {
        const current = prev === null ? intervalSec : prev;
        if (current <= 1) {
          void runWatchRef.current();
          return intervalSec;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [watchIntervalMin]);

  useKeyboardShortcuts({
    disabled: isModalOpen || isTransferAlertOpen,
    onToggleTest: () => {
      if (phase === 'ping' || phase === 'download' || phase === 'upload') {
        handleCancelTest();
      } else if (consoleMode === 'realtime') {
        if (isMonitoring) {
          stopRealtimeMonitor();
        } else {
          startRealtimeMonitor();
        }
      } else {
        void handleTriggerStart();
      }
    },
    onToggleUnit: () =>
      setSpeedUnit((prev) => (prev === 'Mbps' ? 'MBps' : 'Mbps')),
    onToggleMute: toggleMute,
    onOpenHistory: handleOpenHistory,
    onToggleHelp: () => setShowShortcutsHelp((prev) => !prev),
  });

  const liveAnnouncement =
    phase === 'ping'
      ? 'Measuring network ping and jitter.'
      : phase === 'download'
        ? 'Measuring download throughput.'
        : phase === 'upload'
          ? 'Measuring upload throughput.'
          : phase === 'complete' && latestResult
            ? `Speed test complete. Download ${formatSpeedValue(latestResult.downloadMbps, speedUnit)} ${speedUnit}, Upload ${formatSpeedValue(latestResult.uploadMbps, speedUnit)} ${speedUnit}, Veloxis Score ${latestResult.veloxisScore} out of 100.`
            : '';

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div
          id="top"
          className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-200"
        >
          <a
            href="#console"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
          >
            Skip to speed test console
          </a>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {liveAnnouncement}
          </div>

          {/* Desktop Top Navbar + Mobile Bottom Navbar */}
          <AppNav
            activeAnchor={activeAnchor}
            onSelectAnchor={setActiveAnchor}
            historyCount={history.length}
            onOpenHistory={handleOpenHistory}
            onOpenDistribution={() => setIsModalOpen(true)}
            isInstalled={isInstalled}
            cloudUser={cloudUser}
            authLoading={authLoading}
            onSignIn={() => void signInWithGoogle()}
            onSignOut={() => void signOutUser()}
          />

        <div className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence>
            {!isOnline && (
              <motion.div
                initial={{opacity: 0, height: 0}}
                animate={{opacity: 1, height: 'auto'}}
                exit={{opacity: 0, height: 0}}
                transition={{duration: 0.2}}
                className="overflow-hidden border-b border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Offline — Showing cached interface and saved history. Reconnect to run a live speed test.
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-9 space-y-8">
            {/* Hero Context & Integrated Speed Test Console Controls */}
            <div id="console" className="scroll-mt-20 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl text-balance">
                  Internet Speed Test
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {networkInfo.isp || (networkInfo.detected ? 'Unknown ISP' : 'ISP Not Detected')}
                  </span>
                  {networkInfo.country && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {[networkInfo.city, networkInfo.country].filter(Boolean).join(', ')}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{effectiveNode?.label ?? networkInfo.serverNode}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {Math.max(1, mergedDevices.length)}{' '}
                    {mergedDevices.length === 1 ? 'device detected' : 'devices detected'}
                  </span>
                </div>
              </div>

              {/* Integrated Test Mode Controls + Unit & Sound */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  role="group"
                  aria-label="Speed display unit"
                  className="flex items-center gap-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/90 p-1"
                >
                  {(['Mbps', 'MBps'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setSpeedUnit(u)}
                      aria-pressed={speedUnit === u}
                      className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        speedUnit === u
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? 'Unmute test audio feedback' : 'Mute test audio feedback'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  )}
                  <span>{isMuted ? 'Sound Off' : 'Sound On'}</span>
                </button>

                {/* Integrated Speed Test Mode Selector (Quick, Plan File Test, Live Monitor) */}
                <div
                  role="group"
                  aria-label="Speed test method"
                  className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/90 p-1"
                >
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => handleSelectConsoleMode('precision')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 ${
                      consoleMode === 'precision'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Quick Test
                  </button>
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => handleSelectConsoleMode('file')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 ${
                      consoleMode === 'file'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Plan File Test
                  </button>
                  <button
                    type="button"
                    disabled={isTesting && consoleMode !== 'realtime'}
                    onClick={() => handleSelectConsoleMode('realtime')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 ${
                      consoleMode === 'realtime'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Live Monitor
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <EdgeNodeSelector
                nodes={edgeNodes}
                selectedNodeId={selectedNodeId}
                effectiveNode={effectiveNode}
                isProbing={isProbingNodes}
                disabled={isTesting}
                onSelectNode={setSelectedNodeId}
                onReprobe={() => void probeEdgeNodes()}
              />
              {cloudUser && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Cloud Sync active as{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {cloudUser.displayName || cloudUser.email}
                  </span>
                </div>
              )}
            </div>

            <AnimatePresence>
              {(errorMessage || authError) && (
                <motion.div
                  initial={{opacity: 0, y: -6}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: 0.2}}
                  className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-300"
                >
                  {errorMessage || authError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Sticky Test Controls (No horizontal loading bar) */}
            {consoleMode !== 'realtime' ? (
              <div
                aria-label="Mobile speed test controls"
                className="sticky top-0 z-20 -mx-4 border-y border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/95 px-4 py-2.5 backdrop-blur-xs md:hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {(phase === 'ping' || phase === 'download' || phase === 'upload') && (
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            phase === 'upload'
                              ? 'bg-cyan-600 dark:bg-cyan-400'
                              : 'bg-blue-600 dark:bg-blue-400'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">
                        {phase === 'ping'
                          ? `Measuring Ping · ${progressPct}%`
                          : phase === 'download'
                            ? transferProgress
                              ? `Downloading ${formatTransferSize(transferProgress.bytes)} / ${formatTransferSize(transferProgress.targetBytes)}`
                              : `Testing Download · ${progressPct}%`
                            : phase === 'upload'
                              ? transferProgress
                                ? `Uploading ${formatTransferSize(transferProgress.bytes)} / ${formatTransferSize(transferProgress.targetBytes)}`
                                : `Testing Upload · ${progressPct}%`
                              : phase === 'complete'
                                ? 'Test Complete'
                                : phase === 'error'
                                  ? 'Interrupted'
                                  : consoleMode === 'file'
                                    ? `File Test (${formatTransferSize(plannedDlBytes)})`
                                    : 'Speed Test Ready'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      <span>
                        DL <AnimatedNumber value={dlDisplayVal} decimals={unitDecimals} />
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                        /
                      </span>
                      <span>
                        UL <AnimatedNumber value={ulDisplayVal} decimals={unitDecimals} />
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        {speedUnit}
                      </span>
                      {phase === 'ping' || phase === 'download' || phase === 'upload' ? (
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          · {formatDuration(elapsedSeconds, false)}
                          {estimatedRemainingSeconds !== null
                            ? ` / ETA ~${formatDuration(estimatedRemainingSeconds, false)}`
                            : ''}
                        </span>
                      ) : lastDurationSec !== null ? (
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                          · {formatDuration(lastDurationSec)}
                        </span>
                      ) : estimatedTotalSec !== null ? (
                        <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          · Est ~{formatDuration(estimatedTotalSec, false)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-pressed={isMuted}
                      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      )}
                    </button>

                    {phase === 'ping' || phase === 'download' || phase === 'upload' ? (
                      <button
                        type="button"
                        onClick={handleCancelTest}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square
                          className="h-3 w-3 fill-slate-700 text-slate-700 dark:fill-slate-200 dark:text-slate-200"
                          aria-hidden="true"
                        />
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTriggerStart}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 px-4 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {phase === 'complete' ? (
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                        )}
                        <span>{phase === 'complete' ? 'Restart' : 'Start Test'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                aria-label="Mobile live monitor controls"
                className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-y border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/95 px-4 py-2.5 backdrop-blur-xs md:hidden"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {isMonitoring ? 'Live Stream Active' : 'Live Monitor Paused'}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    <AnimatedNumber value={liveDlMonitorVal} decimals={unitDecimals} /> {speedUnit} ·{' '}
                    <AnimatedNumber value={livePingMs} decimals={0} /> ms
                  </div>
                </div>
                {isMonitoring ? (
                  <button
                    type="button"
                    onClick={stopRealtimeMonitor}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pause className="h-3.5 w-3.5 fill-slate-700 dark:fill-slate-200" aria-hidden="true" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRealtimeMonitor}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                    <span>Start Live</span>
                  </button>
                )}
              </div>
            )}

            {/* CONSOLE CONTENT: SPEED TEST (QUICK / FILE) OR INTEGRATED LIVE MONITOR */}
            <AnimatePresence mode="wait">
              {consoleMode !== 'realtime' ? (
                <motion.div
                  key="speedtest-workspace"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
                  className="space-y-8"
                >
                {consoleMode === 'file' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                      <HardDriveDownload
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Subscription File Test transfers{' '}
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatTransferSize(plannedDlBytes)}
                        </span>{' '}
                        down and{' '}
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatTransferSize(plannedUlBytes)}
                        </span>{' '}
                        up based on{' '}
                        {profile.subscribedDownloadMbps !== null
                          ? `your ${Number(convertSpeed(profile.subscribedDownloadMbps, speedUnit).toFixed(1))} ${speedUnit} plan`
                          : 'default 500 MB sizing (set your plan below to match)'}.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isTesting}
                      onClick={() => setIsTransferAlertOpen(true)}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      Configure &amp; Start
                    </button>
                  </div>
                )}

                <section
                  aria-label="Primary speed test console"
                  className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] transition-colors duration-200"
                >
                  <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
                    {/* Left Focal Anchor: Precision Gauge */}
                    <div className="flex items-center justify-center bg-white dark:bg-[#111827] p-6 sm:p-8 lg:col-span-5">
                      <PrecisionGauge
                        phase={phase}
                        progressPct={progressPct}
                        liveSpeedMbps={
                          phase === 'idle' && latestResult
                            ? latestResult.downloadMbps
                            : liveSpeedMbps
                        }
                        speedUnit={speedUnit}
                        transferProgress={transferProgress}
                        elapsedSeconds={elapsedSeconds}
                        estimatedRemainingSeconds={estimatedRemainingSeconds}
                        estimatedTotalSeconds={estimatedTotalSec}
                        lastDurationSec={lastDurationSec}
                        isDark={isDark}
                        onStart={handleTriggerStart}
                        onCancel={handleCancelTest}
                        actionLabel={
                          consoleMode === 'file'
                            ? phase === 'complete'
                              ? 'Run File Test Again'
                              : `Run ${formatTransferSize(plannedDlBytes)} File Test`
                            : undefined
                        }
                      />
                    </div>

                    {/* Right: Banded Metrics & Score */}
                    <div className="flex flex-col justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 lg:col-span-7 lg:border-t-0 lg:border-l">
                      {/* Band 1: Primary Throughput */}
                      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-[#111827] px-6 py-6 sm:px-8 sm:py-7">
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                          <motion.div
                            animate={{
                              opacity: phase === 'ping' ? 0.55 : 1,
                              scale: phase === 'download' ? 1.015 : 1,
                            }}
                            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                            className="flex flex-col justify-between gap-2.5 min-w-0 origin-left"
                          >
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Download Speed
                            </div>
                            <div className="flex items-baseline gap-2 leading-none">
                              <AnimatedNumber
                                value={dlDisplayVal}
                                decimals={unitDecimals}
                                className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums transition-colors duration-200 ${
                                  phase === 'download'
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-900 dark:text-slate-50'
                                }`}
                              />
                              <span className="font-mono text-xs font-medium tracking-wider text-slate-400 dark:text-slate-500">
                                {speedUnit}
                              </span>
                            </div>
                          </motion.div>

                          <motion.div
                            animate={{
                              opacity: phase === 'ping' || phase === 'download' ? 0.55 : 1,
                              scale: phase === 'upload' ? 1.015 : 1,
                            }}
                            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                            className="flex flex-col justify-between gap-2.5 min-w-0 border-t border-slate-100 dark:border-slate-800/80 pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8 origin-left"
                          >
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Upload Speed
                            </div>
                            <div className="flex items-baseline gap-2 leading-none">
                              <AnimatedNumber
                                value={ulDisplayVal}
                                decimals={unitDecimals}
                                className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums transition-colors duration-200 ${
                                  phase === 'upload'
                                    ? 'text-cyan-700 dark:text-cyan-400'
                                    : 'text-slate-900 dark:text-slate-50'
                                }`}
                              />
                              <span className="font-mono text-xs font-medium tracking-wider text-slate-400 dark:text-slate-500">
                                {speedUnit}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Band 2: Latency & Stability Grid */}
                      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/65 dark:bg-slate-900/60 px-6 py-6 sm:px-8">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                          <motion.div
                            animate={{scale: phase === 'ping' ? 1.02 : 1}}
                            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                            className="flex flex-col justify-between gap-2 min-w-0 origin-left"
                          >
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Ping
                            </div>
                            <div className="flex items-baseline gap-1.5 leading-none">
                              <AnimatedNumber
                                value={displayedPing}
                                decimals={0}
                                className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                              />
                              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                                ms
                              </span>
                            </div>
                          </motion.div>

                          <motion.div
                            animate={{opacity: phase === 'ping' ? 0.55 : 1}}
                            transition={{duration: 0.2}}
                            className="flex flex-col justify-between gap-2 min-w-0"
                          >
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Loaded Ping
                            </div>
                            <div className="flex items-baseline gap-1.5 leading-none">
                              <AnimatedNumber
                                value={displayedLoadedPing}
                                decimals={0}
                                className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                              />
                              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                                ms
                              </span>
                            </div>
                          </motion.div>

                          <motion.div
                            animate={{opacity: phase === 'idle' && !latestResult ? 0.8 : 1}}
                            transition={{duration: 0.2}}
                            className="flex flex-col justify-between gap-2 min-w-0"
                          >
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Jitter
                            </div>
                            <div className="flex items-baseline gap-1.5 leading-none">
                              <AnimatedNumber
                                value={displayedJitter}
                                decimals={1}
                                className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                              />
                              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                                ms
                              </span>
                            </div>
                          </motion.div>

                          <div className="flex flex-col justify-between gap-2 min-w-0">
                            <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                              Packet Loss
                            </div>
                            <div className="flex items-baseline gap-1.5 leading-none">
                              <AnimatedNumber
                                value={displayedPing !== null ? displayedLoss : null}
                                decimals={1}
                                className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                              />
                              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Band 3: Veloxis Composite Score Footer */}
                      <motion.div
                        animate={{opacity: isTesting ? 0.65 : 1}}
                        transition={{duration: 0.2}}
                        className="flex flex-wrap items-center justify-between gap-4 bg-slate-100/75 dark:bg-slate-800/45 px-6 py-5 sm:px-8"
                      >
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold leading-snug tracking-[0.01em] text-slate-900 dark:text-slate-50">
                            Veloxis Score
                          </div>
                          <div className="text-xs leading-relaxed tracking-[0.01em] text-slate-500 dark:text-slate-400">
                            {isTesting ? (
                              <span>
                                Elapsed{' '}
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                  {formatDuration(elapsedSeconds)}
                                </span>
                                {estimatedRemainingSeconds !== null && (
                                  <>
                                    {' '}
                                    · Est. remaining{' '}
                                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                                      ~{formatDuration(estimatedRemainingSeconds, false)}
                                    </span>
                                  </>
                                )}
                              </span>
                            ) : lastDurationSec !== null ? (
                              <span>
                                Completed in{' '}
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                  {formatDuration(lastDurationSec)}
                                </span>
                                {estimatedTotalSec !== null && (
                                  <>
                                    {' '}
                                    · Est. duration{' '}
                                    <span className="font-mono tabular-nums">
                                      ~{formatDuration(estimatedTotalSec, false)}
                                    </span>
                                  </>
                                )}
                              </span>
                            ) : (
                              <span>
                                Overall throughput and stability rating
                                {estimatedTotalSec !== null && (
                                  <>
                                    {' '}
                                    · Est. time{' '}
                                    <span className="font-mono tabular-nums">
                                      ~{formatDuration(estimatedTotalSec, false)}
                                    </span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-baseline gap-2 leading-none">
                            <AnimatedNumber
                              value={displayedScore}
                              decimals={0}
                              className="font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                            />
                            <span className="font-mono text-xs tracking-wider text-slate-400 dark:text-slate-500">
                              / 100
                            </span>
                            {scoreMeta && (
                              <span
                                className={`ml-1.5 text-xs font-semibold tracking-[0.01em] ${
                                  scoreMeta.tone === 'emerald'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : scoreMeta.tone === 'blue'
                                      ? 'text-blue-700 dark:text-blue-400'
                                      : scoreMeta.tone === 'amber'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                · {scoreMeta.label}
                              </span>
                            )}
                          </div>

                          {latestResult && !isTesting && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCopyReport()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                              >
                                {copiedReport ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                                )}
                                <span>{copiedReport ? 'Copied' : 'Copy Summary'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadResultReportPng(latestResult, speedUnit, isDark)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                              >
                                <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                <span>Download PNG</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </section>

                {/* Live Throughput Curve */}
                <TelemetryWaveform
                  samples={samples.length > 0 ? samples : latestResult?.samples ?? []}
                  title="Speed & Latency Timeline"
                  subtitle="Live throughput curve during test execution"
                  emptyHint="Run a speed test to view live download and upload stability."
                  speedUnit={speedUnit}
                  isDark={isDark}
                />
                </motion.div>
              ) : (
                <motion.div
                  key="realtime-workspace"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
                  className="space-y-8"
                >
                <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] transition-colors duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 px-6 py-5 sm:px-8">
                    <div className="flex items-center gap-3">
                      <Activity
                        className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <h2 className="text-base font-semibold leading-snug tracking-[0.005em] text-slate-900 dark:text-slate-50">
                          Continuous Real-Time Monitor
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed tracking-[0.01em] text-slate-500 dark:text-slate-400">
                          Samples latency every second and adaptive download bursts every 3 seconds.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {monitorSamples.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveSnapshot}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          <BookmarkPlus
                            className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
                            aria-hidden="true"
                          />
                          <span>Save Snapshot</span>
                        </button>
                      )}

                      {isMonitoring ? (
                        <button
                          type="button"
                          onClick={stopRealtimeMonitor}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          <Pause
                            className="h-3.5 w-3.5 fill-slate-700 dark:fill-slate-200"
                            aria-hidden="true"
                          />
                          <span>Pause Monitor</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRealtimeMonitor}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-400 cursor-pointer whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                          <span>Start Live Monitor</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {snapshotNotice && (
                    <div className="border-b border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-6 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 sm:px-8">
                      {snapshotNotice}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6 bg-slate-50/55 dark:bg-slate-900/55 px-6 py-6 sm:grid-cols-4 sm:px-8">
                    <div className="flex flex-col justify-between gap-2 min-w-0">
                      <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                        Live Throughput
                      </div>
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <AnimatedNumber
                          value={liveDlMonitorVal}
                          decimals={unitDecimals}
                          className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium tracking-wider text-slate-400 dark:text-slate-500">
                          {speedUnit}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-2 min-w-0">
                      <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                        Rolling Ping
                      </div>
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <AnimatedNumber
                          value={livePingMs}
                          decimals={0}
                          className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                          ms
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-2 min-w-0">
                      <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                        Rolling Jitter
                      </div>
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <AnimatedNumber
                          value={liveJitterMs}
                          decimals={1}
                          className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                          ms
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-2 min-w-0">
                      <div className="text-xs font-medium leading-snug tracking-[0.02em] text-slate-500 dark:text-slate-400">
                        Samples Collected
                      </div>
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
                          {monitorSamples.length}
                        </span>
                        <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                          ticks
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <TelemetryWaveform
                  samples={monitorSamples}
                  title="Live Rolling Bandwidth & Ping Stream"
                  subtitle={
                    isMonitoring
                      ? 'Streaming live probes — hover any point to inspect exact timestamp and latency'
                      : 'Press Start Live Monitor to begin continuous telemetry'
                  }
                  emptyHint="Click Start Live Monitor to watch real-time speed bursts and ping stability."
                  speedUnit={speedUnit}
                  isDark={isDark}
                />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Streaming, Gaming, Bufferbloat & DNS Verdicts */}
            <div id="diagnostics" className="scroll-mt-20">
              <ActivityDiagnostics
                activities={latestResult?.activities ?? null}
                isTesting={isTesting}
                speedUnit={speedUnit}
                measuredUploadMbps={displayedUl}
                unloadedPingMs={displayedPing}
                loadedPingMs={displayedLoadedPing}
              />
            </div>

            {/* Non-Intrusive Post-Test Ad Slot */}
            <AdSlot
              placement="post-test-card"
              isTesting={isTesting}
              measuredDownloadMbps={displayedDl}
            />

            {/* Scheduled / Background Reliability Watch */}
            <ReliabilityWatchCard
              intervalMin={watchIntervalMin}
              thresholdPct={watchThresholdPct}
              subscribedDownloadMbps={profile.subscribedDownloadMbps}
              speedUnit={speedUnit}
              countdownSec={watchCountdownSec}
              runsCount={watchRunsCount}
              alertsCount={watchAlertsCount}
              lastAlertMessage={watchAlertMessage}
              notificationsEnabled={notificationsEnabled}
              onChangeInterval={setWatchIntervalMin}
              onChangeThresholdPct={setWatchThresholdPct}
              onToggleNotifications={() => void handleToggleNotifications()}
              onDismissAlert={() => setWatchAlertMessage(null)}
            />

            {/* Connected Devices & ISP Plan Benchmark (directly on main view, no separate nav) */}
            <div id="benchmark" className="scroll-mt-20">
              <DevicePlanBenchmark
                profile={profile}
                onChangeProfile={setProfile}
                measuredDownloadMbps={displayedDl}
                measuredUploadMbps={displayedUl}
                speedUnit={speedUnit}
                networkInfo={networkInfo}
                regionalIsps={regionalIsps}
                detectedDevices={mergedDevices}
                onRefreshNetwork={refreshNetworkInfo}
                onRequestFileTest={() => setIsTransferAlertOpen(true)}
              />
            </div>

            {/* Performance Trends Chart across History */}
            <HistoryTrendsChart
              history={history}
              speedUnit={speedUnit}
              isDark={isDark}
            />

            {/* Expandable Test History Card (triggered by History button or card toggle) */}
            <div className="scroll-mt-20">
              <HistoryView
                history={history}
                speedUnit={speedUnit}
                isDark={isDark}
                isExpanded={isHistoryOpen}
                onToggleExpanded={() => setIsHistoryOpen((prev) => !prev)}
                onClearHistory={() => {
                  clearHistory();
                  broadcastHistoryCleared();
                }}
                onRunNewTest={() => {
                  const el = document.getElementById('console');
                  if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
                  void handleTriggerStart();
                }}
              />
            </div>
          </main>

          <footer className="mt-10 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] pt-6 pb-24 md:pb-6 transition-colors duration-200">
            <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
              <AdSlot
                placement="footer-banner"
                isTesting={isTesting}
                measuredDownloadMbps={displayedDl}
              />

              <AnimatePresence>
                {showShortcutsHelp && (
                  <motion.div
                    initial={{opacity: 0, y: 4}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: 4}}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <span>
                        <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                          Space
                        </kbd>{' '}
                        Start / Cancel
                      </span>
                      <span>
                        <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                          U
                        </kbd>{' '}
                        Toggle Mbps / MBps
                      </span>
                      <span>
                        <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                          M
                        </kbd>{' '}
                        Mute / Unmute
                      </span>
                      <span>
                        <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                          H
                        </kbd>{' '}
                        Jump to History
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowShortcutsHelp(false)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Close
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Veloxis</span>
                  <span aria-hidden="true">·</span>
                  <span>Precision Internet Speed &amp; Connection Telemetry</span>
                  <span aria-hidden="true">·</span>
                  <span>© {new Date().getFullYear()} Veloxis</span>
                  <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsHelp((v) => !v)}
                    className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Shortcuts: Space · U · M · H (?)</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetConsent();
                      const el = document.getElementById('diagnostics');
                      if (el) el.scrollIntoView({behavior: 'smooth', block: 'end'});
                    }}
                    className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Ad Preferences
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenHistory}
                    className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    History ({history.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Install App &amp; Chrome Extension
                  </button>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Data Transfer Size Confirmation Alert Dialog */}
        <TransferAlertModal
          isOpen={isTransferAlertOpen}
          profile={profile}
          speedUnit={speedUnit}
          onChangeProfile={setProfile}
          onClose={() => setIsTransferAlertOpen(false)}
          onConfirmFileTest={(dl, ul) => void handleConfirmFileTest(dl, ul)}
          onSwitchToQuickTest={async () => {
            setConsoleMode('precision');
            lastProgressBucketRef.current = 0;
            playStart();
            const res = await startPrecisionTest({mode: 'precision'});
            if (res) {
              void pushTestRunToCloud(res);
            }
          }}
        />

        <InstallExtensionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isInstallable={isInstallable}
          isInstalled={isInstalled}
          isIOS={isIOS}
          onInstallPWA={install}
          ispName={networkInfo.isp}
        />
      </div>
    </MotionConfig>
    </ErrorBoundary>
  );
}
