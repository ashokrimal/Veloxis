import React from 'react';
import {AlertTriangle, CheckCircle2, Info, Minus, Plus, RefreshCw} from 'lucide-react';
import type {
  BenchmarkProfile,
  BrowserConnectionHint,
  NetworkInfo,
} from '../types/speedtest';
import {calculatePlanBenchmark} from '../utils/scoring';

interface DevicePlanBenchmarkProps {
  profile: BenchmarkProfile;
  onChangeProfile: (next: BenchmarkProfile) => void;
  measuredDownloadMbps: number;
  measuredUploadMbps: number;
  networkInfo: NetworkInfo;
  browserHint: BrowserConnectionHint;
  onRefreshNetwork: () => void;
}

const PLAN_PRESETS: Array<{
  label: string;
  planName: string;
  dl: number;
  ul: number;
  price: number;
}> = [
  {label: '100 Mbps', planName: '100 Mbps Essentials', dl: 100, ul: 20, price: 45},
  {label: '300 Mbps', planName: '300 Mbps Home Fiber', dl: 300, ul: 100, price: 60},
  {label: '500 Mbps', planName: '500 Mbps Pro', dl: 500, ul: 250, price: 75},
  {label: '1 Gbps', planName: '1 Gbps Symmetrical', dl: 1000, ul: 1000, price: 90},
];

const HOUSEHOLD_PRESETS = [
  {label: 'Solo (2)', count: 2, streams: 1, gaming: 0},
  {label: 'Home (5)', count: 5, streams: 1, gaming: 1},
  {label: 'Shared (10)', count: 10, streams: 2, gaming: 2},
  {label: 'Office (16)', count: 16, streams: 1, gaming: 0},
];

export const DevicePlanBenchmark: React.FC<DevicePlanBenchmarkProps> = ({
  profile,
  onChangeProfile,
  measuredDownloadMbps,
  measuredUploadMbps,
  networkInfo,
  browserHint,
  onRefreshNetwork,
}) => {
  const benchmark = calculatePlanBenchmark(
    profile,
    measuredDownloadMbps,
    measuredUploadMbps,
  );

  const hasMeasurement = measuredDownloadMbps > 0;
  const clampedDelivery = Math.min(100, Math.max(0, benchmark.downloadDeliveryPct));

  const statusTone =
    benchmark.capacityStatus === 'Optimal'
      ? {color: 'text-emerald-700', Icon: CheckCircle2}
      : benchmark.capacityStatus === 'Balanced'
        ? {color: 'text-blue-700', Icon: CheckCircle2}
        : {color: 'text-amber-700', Icon: AlertTriangle};

  return (
    <section
      aria-label="ISP subscription benchmark and household device estimator"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      {/* Detected ISP & Connection Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            ISP Plan Benchmark &amp; Household Devices
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{networkInfo.isp}</span>
            {networkInfo.asn && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{networkInfo.asn}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono">{networkInfo.ip}</span>
            {networkInfo.city && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {networkInfo.city}
                  {networkInfo.country ? `, ${networkInfo.country}` : ''}
                </span>
              </>
            )}
            {browserHint.effectiveType && (
              <>
                <span aria-hidden="true">·</span>
                <span>Browser Link: {browserHint.effectiveType.toUpperCase()}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRefreshNetwork}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>Refresh ISP</span>
        </button>
      </div>

      {/* Two-Column Controls: Subscription Tier vs Connected Devices */}
      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: ISP Subscription Plan */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700">
              Your ISP Subscription Tier
            </label>
            <span className="text-xs font-mono text-slate-400">
              {profile.planName}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1">
            {PLAN_PRESETS.map((preset) => {
              const active =
                profile.subscribedDownloadMbps === preset.dl &&
                profile.subscribedUploadMbps === preset.ul;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onChangeProfile({
                      ...profile,
                      planName: preset.planName,
                      subscribedDownloadMbps: preset.dl,
                      subscribedUploadMbps: preset.ul,
                      monthlyPriceUsd: preset.price,
                    })
                  }
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="sub-dl"
                className="block text-[11px] font-medium text-slate-500"
              >
                Plan Down (Mbps)
              </label>
              <input
                id="sub-dl"
                type="number"
                min={1}
                max={10000}
                value={profile.subscribedDownloadMbps}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    planName: 'Custom Plan',
                    subscribedDownloadMbps: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sub-ul"
                className="block text-[11px] font-medium text-slate-500"
              >
                Plan Up (Mbps)
              </label>
              <input
                id="sub-ul"
                type="number"
                min={1}
                max={10000}
                value={profile.subscribedUploadMbps}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    planName: 'Custom Plan',
                    subscribedUploadMbps: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sub-price"
                className="block text-[11px] font-medium text-slate-500"
              >
                Monthly ($ USD)
              </label>
              <input
                id="sub-price"
                type="number"
                min={0}
                max={1000}
                value={profile.monthlyPriceUsd}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    monthlyPriceUsd: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right: Connected Household Devices */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Active Connected Devices on Network
            </span>
            <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
              {profile.connectedDevices}{' '}
              {profile.connectedDevices === 1 ? 'device' : 'devices'}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1">
            {HOUSEHOLD_PRESETS.map((preset) => {
              const active = profile.connectedDevices === preset.count;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onChangeProfile({
                      ...profile,
                      connectedDevices: preset.count,
                      active4KStreams: preset.streams,
                      gamingDevices: preset.gaming,
                    })
                  }
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease connected devices"
                onClick={() =>
                  onChangeProfile({
                    ...profile,
                    connectedDevices: Math.max(1, profile.connectedDevices - 1),
                  })
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center font-mono text-sm font-bold text-slate-900 tabular-nums">
                {profile.connectedDevices}
              </span>
              <button
                type="button"
                aria-label="Increase connected devices"
                onClick={() =>
                  onChangeProfile({
                    ...profile,
                    connectedDevices: Math.min(100, profile.connectedDevices + 1),
                  })
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5">
                <span>4K TVs:</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={profile.active4KStreams}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      active4KStreams: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-12 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </label>

              <label className="flex items-center gap-1.5">
                <span>Gaming:</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={profile.gamingDevices}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      gamingDevices: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-12 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </label>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Modern browsers block local Wi-Fi ARP scanning for privacy; enter your active household device count to calculate per-device headroom accurately.
            </span>
          </p>
        </div>
      </div>

      {/* Computed Delivery & Headroom Strip */}
      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Plan Delivery (Download)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {hasMeasurement ? `${benchmark.downloadDeliveryPct}%` : '--'}
            </span>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              of {profile.subscribedDownloadMbps} Mbps
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-600 transition-transform duration-200 origin-left"
              style={{
                transform: `scaleX(${hasMeasurement ? clampedDelivery / 100 : 0})`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Upload Delivery</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {hasMeasurement ? `${benchmark.uploadDeliveryPct}%` : '--'}
            </span>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              of {profile.subscribedUploadMbps} Mbps
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Measured: {hasMeasurement ? `${measuredUploadMbps.toFixed(1)} Mbps` : 'Run test'}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Per-Device Share</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {hasMeasurement ? benchmark.perDeviceMbps.toFixed(1) : '--'}
            </span>
            <span className="font-mono text-xs text-slate-400">Mbps / device</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium">
            {hasMeasurement ? (
              <span className={`inline-flex items-center gap-1 ${statusTone.color}`}>
                <statusTone.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{benchmark.capacityStatus} Headroom</span>
              </span>
            ) : (
              <span className="text-slate-400">Run speed test to evaluate</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Effective Cost / 100 Mbps</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {hasMeasurement ? `$${benchmark.costPer100Mbps.toFixed(2)}` : '--'}
            </span>
            <span className="font-mono text-xs text-slate-400">/ mo</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Free headroom after load:{' '}
            {hasMeasurement ? `${benchmark.remainingMbps.toFixed(0)} Mbps` : '--'}
          </div>
        </div>
      </div>
    </section>
  );
};
