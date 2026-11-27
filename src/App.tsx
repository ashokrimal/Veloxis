import {useEffect, useState} from 'react';
import {Activity, BookmarkPlus, Pause, Play, WifiOff} from 'lucide-react';
import {MotionConfig, motion} from 'motion/react';
import {ActivityDiagnostics} from './components/ActivityDiagnostics';
import {AdSlot} from './components/AdSlot';
import {AnimatedNumber} from './components/AnimatedNumber';
import {DevicePlanBenchmark} from './components/DevicePlanBenchmark';
import {Header} from './components/Header';
import {HistoryView} from './components/HistoryView';
import {InstallExtensionModal} from './components/InstallExtensionModal';
import {PrecisionGauge} from './components/PrecisionGauge';
import {TelemetryWaveform} from './components/TelemetryWaveform';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {usePWAInstall} from './hooks/usePWAInstall';
import {useSpeedTest} from './hooks/useSpeedTest';
import type {BenchmarkProfile, NavSection} from './types/speedtest';
import {getScoreLabel} from './utils/scoring';

const PROFILE_STORAGE_KEY = 'veloxis_benchmark_profile_v1';

const DEFAULT_PROFILE: BenchmarkProfile = {
  planName: '300 Mbps Home Fiber',
  subscribedDownloadMbps: 300,
  subscribedUploadMbps: 100,
  monthlyPriceUsd: 60,
  connectedDevices: 5,
  active4KStreams: 1,
  gamingDevices: 1,
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

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('speedtest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<BenchmarkProfile>(loadProfile);

  const isOnline = useOnlineStatus();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();

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
    samples,
    latestResult,
    history,
    networkInfo,
    browserHint,
    errorMessage,
    isMonitoring,
    monitorSamples,
    startPrecisionTest,
    cancelTest,
    startRealtimeMonitor,
    stopRealtimeMonitor,
    saveMonitorSnapshot,
    clearHistory,
    refreshNetworkInfo,
  } = useSpeedTest();

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

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

  const handleSelectSection = (section: NavSection) => {
    setActiveSection(section);
    if (section !== 'monitor' && isMonitoring) {
      stopRealtimeMonitor();
    }
  };

  const handleSaveSnapshot = () => {
    const saved = saveMonitorSnapshot();
    if (saved) {
      setSnapshotNotice(`Saved snapshot (${saved.downloadMbps.toFixed(1)} Mbps · Score ${saved.veloxisScore})`);
      window.setTimeout(() => setSnapshotNotice(null), 3500);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <Header
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onOpenDistribution={() => setIsModalOpen(true)}
        isInstalled={isInstalled}
      />

      {!isOnline && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Offline — Showing cached interface and saved history. Reconnect to run a live speed test.</span>
          </span>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Top Context & Mode Switcher Row (Hero Toolbar) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
              {activeSection === 'monitor'
                ? 'Real-Time Network Stability Monitor'
                : activeSection === 'benchmark'
                  ? 'ISP Plan & Household Device Benchmark'
                  : activeSection === 'history'
                    ? 'Speed Test History & Trends'
                    : 'Precision Internet Speed Test'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{networkInfo.isp}</span>
              {networkInfo.asn && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{networkInfo.asn}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{networkInfo.serverNode}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {profile.connectedDevices} {profile.connectedDevices === 1 ? 'device' : 'devices'} configured
              </span>
            </div>
          </div>

          {/* Segmented Mode Control (Speed Test vs Real-Time Monitor) */}
          {(activeSection === 'speedtest' || activeSection === 'monitor') && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => handleSelectSection('speedtest')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeSection === 'speedtest'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Precision Test
              </button>
              <button
                type="button"
                onClick={() => handleSelectSection('monitor')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeSection === 'monitor'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Real-Time Monitor
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            {errorMessage}
          </div>
        )}

        {/* VIEW 1: PRECISION SPEED TEST */}
        {activeSection === 'speedtest' && (
          <>
            <section
              aria-label="Primary speed test console"
              className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"
            >
              <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
                {/* Left Focal Anchor: Precision Gauge */}
                <div className="lg:col-span-5">
                  <PrecisionGauge
                    phase={phase}
                    progressPct={progressPct}
                    liveSpeedMbps={
                      phase === 'idle' && latestResult
                        ? latestResult.downloadMbps
                        : liveSpeedMbps
                    }
                    onStart={startPrecisionTest}
                    onCancel={cancelTest}
                  />
                </div>

                {/* Right: Calibrated Metrics Grid + Veloxis Score */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    <motion.div
                      animate={{
                        opacity: phase === 'ping' ? 0.55 : 1,
                        scale: phase === 'download' ? 1.02 : 1,
                      }}
                      transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                      className="border-b border-slate-100 pb-3 origin-left"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Download</span>
                        {phase === 'download' && (
                          <span className="text-[10px] font-semibold text-blue-600">
                            · Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedDl > 0 ? displayedDl : phase === 'download' ? 0 : null}
                          decimals={1}
                          className={`font-mono text-2xl font-bold tabular-nums transition-colors duration-200 ${
                            phase === 'download' ? 'text-blue-600' : 'text-slate-900'
                          }`}
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          Mbps
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      animate={{
                        opacity: phase === 'ping' || phase === 'download' ? 0.55 : 1,
                        scale: phase === 'upload' ? 1.02 : 1,
                      }}
                      transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                      className="border-b border-slate-100 pb-3 origin-left"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Upload</span>
                        {phase === 'upload' && (
                          <span className="text-[10px] font-semibold text-cyan-700">
                            · Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedUl > 0 ? displayedUl : phase === 'upload' ? 0 : null}
                          decimals={1}
                          className={`font-mono text-2xl font-bold tabular-nums transition-colors duration-200 ${
                            phase === 'upload' ? 'text-cyan-700' : 'text-slate-900'
                          }`}
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          Mbps
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      animate={{scale: phase === 'ping' ? 1.02 : 1}}
                      transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                      className="border-b border-slate-100 pb-3 origin-left"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Unloaded Ping</span>
                        {phase === 'ping' && (
                          <span className="text-[10px] font-semibold text-blue-600">
                            · Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedPing}
                          decimals={0}
                          className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          ms
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      animate={{opacity: phase === 'ping' ? 0.55 : 1}}
                      transition={{duration: 0.2}}
                      className="border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0"
                    >
                      <div className="text-xs text-slate-500">Loaded Latency</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedLoadedPing}
                          decimals={0}
                          className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          ms
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      animate={{opacity: phase === 'idle' && !latestResult ? 0.8 : 1}}
                      transition={{duration: 0.2}}
                      className="border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0"
                    >
                      <div className="text-xs text-slate-500">Jitter</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedJitter}
                          decimals={1}
                          className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          ms
                        </span>
                      </div>
                    </motion.div>

                    <div>
                      <div className="text-xs text-slate-500">Packet Loss</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={displayedPing !== null ? displayedLoss : null}
                          decimals={1}
                          className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                        />
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Veloxis Composite Score Bar */}
                  <motion.div
                    animate={{opacity: isTesting ? 0.65 : 1}}
                    transition={{duration: 0.2}}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">
                          Veloxis Connection Score
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Weighted across throughput, loaded bufferbloat, jitter, and packet loss
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <AnimatedNumber
                          value={displayedScore}
                          decimals={0}
                          className="font-mono text-3xl font-bold text-slate-900 tabular-nums"
                        />
                        <span className="font-mono text-xs text-slate-400">/ 100</span>
                        {scoreMeta && (
                          <span
                            className={`ml-1 text-xs font-semibold ${
                              scoreMeta.tone === 'emerald'
                                ? 'text-emerald-700'
                                : scoreMeta.tone === 'blue'
                                  ? 'text-blue-700'
                                  : scoreMeta.tone === 'amber'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                            }`}
                          >
                            · {scoreMeta.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* Live Throughput Curve */}
            <TelemetryWaveform
              samples={samples.length > 0 ? samples : latestResult?.samples ?? []}
              title="Throughput & Latency Timeline"
              subtitle="Real-time download and upload sampling across the measurement window"
              emptyHint="Start a speed test to inspect real-time download ramp-up, upload stability, and latency samples."
            />

            {/* Streaming, Gaming & Browsing Verdicts */}
            <ActivityDiagnostics
              activities={latestResult?.activities ?? null}
              isTesting={isTesting}
            />

            {/* Non-Intrusive Post-Test Ad Slot */}
            <AdSlot
              placement="post-test-card"
              isTesting={isTesting}
              measuredDownloadMbps={displayedDl}
            />

            {/* Household Device Counter & ISP Subscription Benchmark */}
            <div id="benchmark">
              <DevicePlanBenchmark
                profile={profile}
                onChangeProfile={setProfile}
                measuredDownloadMbps={displayedDl}
                measuredUploadMbps={displayedUl}
                networkInfo={networkInfo}
                browserHint={browserHint}
                onRefreshNetwork={refreshNetworkInfo}
              />
            </div>
          </>
        )}

        {/* VIEW 2: REAL-TIME CONTINUOUS MONITOR */}
        {activeSection === 'monitor' && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Continuous Connection Heartbeat
                    </h2>
                    <p className="text-xs text-slate-500">
                      Samples latency every second and adaptive download bursts every 3 seconds to surface throttling or Wi-Fi drops.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {monitorSamples.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveSnapshot}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      <span>Save Snapshot</span>
                    </button>
                  )}

                  {isMonitoring ? (
                    <button
                      type="button"
                      onClick={stopRealtimeMonitor}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <Pause className="h-3.5 w-3.5 fill-slate-700" aria-hidden="true" />
                      <span>Pause Monitor</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRealtimeMonitor}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                      <span>Start Live Monitor</span>
                    </button>
                  )}
                </div>
              </div>

              {snapshotNotice && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
                  {snapshotNotice}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Live Throughput</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <AnimatedNumber
                      value={liveDownloadMbps}
                      decimals={1}
                      className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                    />
                    <span className="font-mono text-xs text-slate-400">Mbps</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Rolling Ping</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <AnimatedNumber
                      value={livePingMs}
                      decimals={0}
                      className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                    />
                    <span className="font-mono text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Rolling Jitter</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <AnimatedNumber
                      value={liveJitterMs}
                      decimals={1}
                      className="font-mono text-2xl font-bold text-slate-900 tabular-nums"
                    />
                    <span className="font-mono text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Samples Collected</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {monitorSamples.length}
                    </span>
                    <span className="font-mono text-xs text-slate-400">ticks</span>
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
            />
          </>
        )}

        {/* VIEW 3: PLAN BENCHMARK */}
        {activeSection === 'benchmark' && (
          <>
            <DevicePlanBenchmark
              profile={profile}
              onChangeProfile={setProfile}
              measuredDownloadMbps={displayedDl}
              measuredUploadMbps={displayedUl}
              networkInfo={networkInfo}
              browserHint={browserHint}
              onRefreshNetwork={refreshNetworkInfo}
            />
            <ActivityDiagnostics
              activities={latestResult?.activities ?? null}
              isTesting={isTesting}
            />
          </>
        )}

        {/* VIEW 4: HISTORY */}
        {activeSection === 'history' && (
          <HistoryView
            history={history}
            onClearHistory={clearHistory}
            onRunNewTest={() => {
              setActiveSection('speedtest');
              startPrecisionTest();
            }}
          />
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
          <AdSlot
            placement="footer-banner"
            isTesting={isTesting}
            measuredDownloadMbps={displayedDl}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Veloxis</span>
              <span aria-hidden="true">·</span>
              <span>Precision Internet Speed &amp; Connection Telemetry</span>
              <span aria-hidden="true">·</span>
              <span>© {new Date().getFullYear()} Veloxis</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Install App &amp; Chrome Extension
              </button>
            </div>
          </div>
        </div>
      </footer>

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
  );
}
