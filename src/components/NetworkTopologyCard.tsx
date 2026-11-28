import React, {useEffect, useState} from 'react';
import {
  Check,
  Copy,
  Cpu,
  Download,
  Laptop,
  Network,
  Phone,
  RefreshCw,
  Router,
  Smartphone,
  Terminal,
  Tv,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {
  NetworkDeviceCategory,
  NetworkTopologyReport,
  WebRtcProbeResult,
} from '../types/speedtest';

interface NetworkTopologyCardProps {
  token: string;
  topology: NetworkTopologyReport | null;
  webrtcProbe: WebRtcProbeResult | null;
  isScanning: boolean;
  scanError: string | null;
  publicIpHint?: string;
  onScan: () => void;
}

const CATEGORY_META: Array<{
  key: NetworkDeviceCategory;
  label: string;
  Icon: React.FC<{className?: string}>;
}> = [
  {key: 'router', label: 'Routers / APs', Icon: Router},
  {key: 'mobile', label: 'Mobiles', Icon: Smartphone},
  {key: 'laptop', label: 'Laptops / PCs', Icon: Laptop},
  {key: 'landline', label: 'Landline / VoIP', Icon: Phone},
  {key: 'tv', label: 'Smart TVs', Icon: Tv},
  {key: 'other', label: 'Other Devices', Icon: Cpu},
];

function CategoryIcon({category}: {category: NetworkDeviceCategory}) {
  const match = CATEGORY_META.find((c) => c.key === category);
  const Icon = match ? match.Icon : Cpu;
  return <Icon className="h-4 w-4 text-stone-500 dark:text-slate-400 shrink-0" />;
}

export const NetworkTopologyCard: React.FC<NetworkTopologyCardProps> = ({
  token,
  topology,
  webrtcProbe,
  isScanning,
  scanError,
  onScan,
}) => {
  const [showProbeSetup, setShowProbeSetup] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (!topology && !isScanning) {
      onScan();
    }
  }, [isScanning, onScan, topology]);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const probeUrl = `${origin}/api/lan-agent/script?token=${encodeURIComponent(token)}`;
  const probeCommand = `curl -sSL "${probeUrl}" | node`;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(probeCommand);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const primaryRouter =
    topology?.routers.find((r) => r.role === 'primary') ?? null;
  const secondaryRouters =
    topology?.routers.filter((r) => r.role === 'secondary') ?? [];

  return (
    <section
      aria-label="ISP router topology and connected network devices"
      className="rounded-xl bg-white dark:bg-[#0D1322] p-6 sm:p-8 vx-card transition-colors duration-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Network
            className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-1"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-slate-50">
              Router Topology &amp; Whole-ISP Connected Devices
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
              {topology?.probeConnected
                ? `Live LAN hop & neighbor scan received (${topology.categoryCounts.total} verified devices on ${topology.isp || topology.publicIp}).`
                : 'Showing only verified network responses received from your ISP connection — no simulated or assumed devices.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowProbeSetup((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#131C31] px-3 py-2 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] vx-btn-secondary cursor-pointer whitespace-nowrap"
          >
            <Terminal className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
            <span>{showProbeSetup ? 'Hide LAN Probe' : 'Local LAN Probe'}</span>
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={onScan}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAE6DD]/60 dark:bg-[#131C31] px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:bg-[#EAE6DD] dark:hover:bg-[#1A2540] vx-btn-secondary disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isScanning ? 'Scanning...' : 'Send Network Request'}</span>
          </button>
        </div>
      </div>

      {scanError && (
        <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
          {scanError}
        </div>
      )}

      {/* Primary vs Secondary Router Detection */}
      <div className="mt-6 border-t border-[#EAE6DD] dark:border-[#1E2942] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-700 dark:text-slate-200">
          <span>Router Path &amp; Operating Mode</span>
          {webrtcProbe?.supported && webrtcProbe.subnetHint && (
            <span className="font-mono font-normal text-[11px] text-stone-500 dark:text-slate-400">
              Browser WebRTC subnet: {webrtcProbe.subnetHint}
              {webrtcProbe.natMismatch ? ' · NAT mismatch detected' : ''}
            </span>
          )}
        </div>

        {topology?.probeConnected && (primaryRouter || secondaryRouters.length > 0) ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {secondaryRouters.map((sec) => (
              <div
                key={sec.id}
                className="rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-amber-950/30 p-4 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900 dark:text-slate-50">
                    Secondary Router (Active Path)
                  </span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {sec.mode}
                  </span>
                </div>
                <div className="mt-2 font-mono text-stone-700 dark:text-slate-200 tabular-nums">
                  {sec.ip}
                  {sec.subnet ? ` · ${sec.subnet}` : ''}
                  {sec.latencyMs !== null && sec.latencyMs !== undefined
                    ? ` · ${sec.latencyMs} ms hop`
                    : ''}
                </div>
                {(sec.vendor || sec.mac || sec.hostname) && (
                  <div className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                    {[sec.hostname, sec.vendor, sec.mac].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            ))}

            {primaryRouter && (
              <div className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900 dark:text-slate-50">
                    Primary Router
                  </span>
                  <span className="font-medium text-[#1D4ED8] dark:text-[#38BDF8]">
                    {primaryRouter.mode}
                  </span>
                </div>
                <div className="mt-2 font-mono text-stone-700 dark:text-slate-200 tabular-nums">
                  {primaryRouter.ip}
                  {primaryRouter.subnet ? ` · ${primaryRouter.subnet}` : ''}
                  {primaryRouter.latencyMs !== null &&
                  primaryRouter.latencyMs !== undefined
                    ? ` · ${primaryRouter.latencyMs} ms hop`
                    : ''}
                </div>
                {(primaryRouter.vendor || primaryRouter.mac || primaryRouter.hostname) && (
                  <div className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                    {[
                      primaryRouter.hostname,
                      primaryRouter.vendor,
                      primaryRouter.mac,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-4 py-3 text-xs text-stone-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Public ISP Gateway:{' '}
                <strong className="font-mono text-stone-900 dark:text-slate-100">
                  {topology?.publicIp || 'Querying...'}
                </strong>
                {topology?.isp ? ` (${topology.isp})` : ''}
              </span>
              {!topology?.probeConnected && (
                <button
                  type="button"
                  onClick={() => setShowProbeSetup(true)}
                  className="font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:underline cursor-pointer"
                >
                  Run LAN Probe to inspect Primary / Secondary Routers
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500 dark:text-slate-400">
              Web browsers sandbox raw ARP and traceroute packets for security. Run the zero-dependency Veloxis LAN Probe on your Wi-Fi/LAN once to receive exact primary router, secondary router mode (Router Double-NAT vs AP/Bridge), and every connected device.
            </p>
          </div>
        )}
      </div>

      {/* Expandable Local LAN Probe Command / Script */}
      <AnimatePresence>
        {showProbeSetup && (
          <motion.div
            initial={{opacity: 0, height: 0}}
            animate={{opacity: 1, height: 'auto'}}
            exit={{opacity: 0, height: 0}}
            transition={{duration: 0.2}}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-stone-900 dark:text-slate-100">
                  Local LAN &amp; Router Discovery Probe (Node.js)
                </span>
                <a
                  href={`${probeUrl}&download=1`}
                  download="veloxis-lan-probe.mjs"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download veloxis-lan-probe.mjs</span>
                </a>
              </div>
              <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                Runs traceroute &amp; ARP/neighbor discovery locally on your network and posts the real router hops and device inventory directly to this session:
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#060913] px-3 py-2">
                <code className="truncate font-mono text-[11px] text-stone-800 dark:text-slate-200">
                  {probeCommand}
                </code>
                <button
                  type="button"
                  onClick={() => void copyCommand()}
                  className="inline-flex items-center gap-1 rounded border border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#131C31] px-2 py-1 text-[11px] font-medium text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1A2540] shrink-0 cursor-pointer"
                >
                  {copiedCmd ? (
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real Connected Device Category Breakdown */}
      <div className="mt-6 border-t border-[#EAE6DD] dark:border-[#1E2942] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-stone-700 dark:text-slate-200">
            Connected Devices on ISP Connection
          </span>
          <span className="font-mono text-xs font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
            Total Verified: {topology?.categoryCounts.total ?? 0}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_META.map(({key, label, Icon}) => {
            const count = topology?.categoryCounts[key] ?? 0;
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400 shrink-0" />
                  <span className="truncate text-[11px] font-medium text-stone-600 dark:text-slate-300">
                    {label}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Real Verified Device List */}
        {topology && topology.devices.length > 0 ? (
          <div className="mt-4 divide-y divide-[#EAE6DD] dark:divide-[#1E2942] rounded-lg border border-[#EAE6DD] dark:border-[#1E2942]">
            {topology.devices.map((dev) => (
              <div
                key={dev.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon category={dev.category} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900 dark:text-slate-100">
                      {dev.label}
                      {dev.isCurrentDevice && (
                        <span className="ml-2 text-[11px] font-normal text-[#1D4ED8] dark:text-[#38BDF8]">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-stone-400 dark:text-slate-500 font-mono">
                      {[
                        dev.category.toUpperCase(),
                        dev.ip,
                        dev.mac,
                        dev.vendor,
                        dev.routerRole && dev.routerRole !== 'unknown'
                          ? `${dev.routerRole} router`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-[11px] text-stone-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {dev.source === 'lan-probe' ? 'LAN Probe' : 'Veloxis Session'}
                  {dev.rttMs ? ` · ${dev.rttMs} ms` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-stone-500 dark:text-slate-400">
            Sending network request to detect active devices on your ISP connection...
          </p>
        )}
      </div>
    </section>
  );
};
