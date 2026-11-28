import React, {useEffect, useState} from 'react';
import {
  ExternalLink,
  Info,
  Laptop,
  MapPin,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
} from 'lucide-react';
import {motion} from 'motion/react';
import type {
  BenchmarkProfile,
  DetectedDevice,
  NetworkInfo,
  RegionalIspsResponse,
  SpeedUnit,
} from '../types/speedtest';
import {formatDataVolume} from '../utils/deviceDetection';
import {
  calculatePlanBenchmark,
  convertSpeed,
  formatCurrency,
  formatSpeedValue,
  getClosestStandardTierMbps,
  toMbps,
} from '../utils/scoring';

interface DevicePlanBenchmarkProps {
  profile: BenchmarkProfile;
  onChangeProfile: (next: BenchmarkProfile) => void;
  measuredDownloadMbps: number;
  measuredUploadMbps: number;
  speedUnit: SpeedUnit;
  networkInfo: NetworkInfo;
  regionalIsps: RegionalIspsResponse;
  detectedDevices: DetectedDevice[];
  onRefreshNetwork: () => void;
  onRequestFileTest?: () => void;
}

const STANDARD_TIERS_MBPS = [30, 50, 100, 200, 300, 500, 1000];

const CURRENCY_OPTIONS = [
  'USD',
  'NPR',
  'INR',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'TWD',
  'JPY',
  'SGD',
  'MYR',
  'AED',
  'PKR',
  'BDT',
  'PHP',
  'BRL',
  'KRW',
];

function DeviceIcon({type}: {type: DetectedDevice['deviceType']}) {
  if (type === 'Mobile') {
    return (
      <Smartphone
        className="h-4 w-4 text-stone-500 dark:text-slate-400 shrink-0"
        aria-hidden="true"
      />
    );
  }
  if (type === 'Tablet') {
    return (
      <Tablet
        className="h-4 w-4 text-stone-500 dark:text-slate-400 shrink-0"
        aria-hidden="true"
      />
    );
  }
  return (
    <Laptop
      className="h-4 w-4 text-stone-500 dark:text-slate-400 shrink-0"
      aria-hidden="true"
    />
  );
}

export const DevicePlanBenchmark: React.FC<DevicePlanBenchmarkProps> = ({
  profile,
  onChangeProfile,
  measuredDownloadMbps,
  measuredUploadMbps,
  speedUnit,
  networkInfo,
  regionalIsps,
  detectedDevices,
  onRefreshNetwork,
  onRequestFileTest,
}) => {
  const effectiveCurrency =
    profile.currencyCode || networkInfo.currencyCode || 'USD';

  const [dlInput, setDlInput] = useState<string>(() =>
    profile.subscribedDownloadMbps !== null
      ? String(
          Number(
            convertSpeed(profile.subscribedDownloadMbps, speedUnit).toFixed(2),
          ),
        )
      : '',
  );
  const [ulInput, setUlInput] = useState<string>(() =>
    profile.subscribedUploadMbps !== null
      ? String(
          Number(
            convertSpeed(profile.subscribedUploadMbps, speedUnit).toFixed(2),
          ),
        )
      : '',
  );
  const [priceInput, setPriceInput] = useState<string>(() =>
    profile.monthlyPrice !== null ? String(profile.monthlyPrice) : '',
  );

  // Sync displayed input numbers whenever unit or external tier selection changes
  useEffect(() => {
    setDlInput(
      profile.subscribedDownloadMbps !== null
        ? String(
            Number(
              convertSpeed(profile.subscribedDownloadMbps, speedUnit).toFixed(2),
            ),
          )
        : '',
    );
  }, [profile.subscribedDownloadMbps, speedUnit]);

  useEffect(() => {
    setUlInput(
      profile.subscribedUploadMbps !== null
        ? String(
            Number(
              convertSpeed(profile.subscribedUploadMbps, speedUnit).toFixed(2),
            ),
          )
        : '',
    );
  }, [profile.subscribedUploadMbps, speedUnit]);

  useEffect(() => {
    setPriceInput(
      profile.monthlyPrice !== null ? String(profile.monthlyPrice) : '',
    );
  }, [profile.monthlyPrice]);

  const deviceCount = Math.max(1, detectedDevices.length);
  const benchmark = calculatePlanBenchmark(
    profile,
    measuredDownloadMbps,
    measuredUploadMbps,
    deviceCount,
  );

  const hasMeasurement = measuredDownloadMbps > 0;
  const clampedDelivery =
    benchmark.downloadDeliveryPct !== null
      ? Math.min(100, Math.max(0, benchmark.downloadDeliveryPct))
      : 0;
  const totalBytesAll = detectedDevices.reduce(
    (sum, d) => sum + d.totalBytesUsed,
    0,
  );

  const closestTierMbps = getClosestStandardTierMbps(measuredDownloadMbps);

  const locationLabel = [networkInfo.city, networkInfo.region, networkInfo.country]
    .filter(Boolean)
    .join(', ');

  const rateSearchQuery = [
    networkInfo.isp && networkInfo.detected ? networkInfo.isp : 'broadband internet',
    'internet plans pricing',
    networkInfo.city,
    networkInfo.country,
  ]
    .filter(Boolean)
    .join(' ');
  const rateSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(rateSearchQuery)}`;

  const handleSelectTier = (tierMbps: number) => {
    onChangeProfile({
      ...profile,
      planName: `${tierMbps} Mbps Plan`,
      subscribedDownloadMbps: tierMbps,
      currencyCode: effectiveCurrency,
    });
  };

  const handleDlChange = (raw: string) => {
    setDlInput(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChangeProfile({...profile, subscribedDownloadMbps: null, planName: ''});
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChangeProfile({
        ...profile,
        subscribedDownloadMbps: Number(toMbps(parsed, speedUnit).toFixed(2)),
        planName: `${trimmed} ${speedUnit} Plan`,
        currencyCode: effectiveCurrency,
      });
    }
  };

  const handleUlChange = (raw: string) => {
    setUlInput(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChangeProfile({...profile, subscribedUploadMbps: null});
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChangeProfile({
        ...profile,
        subscribedUploadMbps: Number(toMbps(parsed, speedUnit).toFixed(2)),
        currencyCode: effectiveCurrency,
      });
    }
  };

  const handlePriceChange = (raw: string) => {
    setPriceInput(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChangeProfile({...profile, monthlyPrice: null});
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChangeProfile({
        ...profile,
        monthlyPrice: parsed,
        currencyCode: effectiveCurrency,
      });
    }
  };

  // Cost normalized to 100 Mbps (or 10 MBps when viewing in MBps)
  const unitCostDisplay =
    benchmark.costPer100Mbps !== null
      ? speedUnit === 'MBps'
        ? benchmark.costPer100Mbps * 0.8 // 10 MBps = 80 Mbps -> 0.8x of costPer100Mbps
        : benchmark.costPer100Mbps
      : null;

  return (
    <section
      aria-label="Automatic connected devices and ISP plan benchmark"
      className="space-y-6"
    >
      {/* Card 1: Automatically Detected Devices & Internet Usage Per Device */}
      <div className="rounded-xl bg-white dark:bg-[#0D1322] p-6 sm:p-8 vx-card transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-slate-50">
              Connected Devices &amp; Internet Usage
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-slate-400">
              {networkInfo.detected
                ? `Detected network: ${networkInfo.isp || 'Unknown ISP'}${networkInfo.asn ? ` (${networkInfo.asn})` : ''} · ${networkInfo.ip}`
                : `ISP & public location unavailable (${networkInfo.ip}) — reconnect or check network`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-stone-500 dark:text-slate-400">
                Session Total
              </div>
              <div className="font-mono text-sm font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                {formatDataVolume(totalBytesAll)}
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshNetwork}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] px-3.5 py-2 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <span>Rescan</span>
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#EAE6DD] dark:border-[#1E2942] text-xs text-stone-500 dark:text-slate-400">
                <th className="pb-3 pr-4 font-medium">Device</th>
                <th className="pb-3 px-4 font-medium">Connection</th>
                <th className="pb-3 px-4 text-right font-medium">
                  Bandwidth Share
                </th>
                <th className="pb-3 px-4 text-right font-medium">Data Used</th>
                <th className="pb-3 pl-4 text-right font-medium">
                  Max Hourly Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DD] dark:divide-[#1E2942]">
              {detectedDevices.map((dev) => (
                <tr key={dev.deviceId} className="h-14">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <DeviceIcon type={dev.deviceType} />
                      <div>
                        <div className="font-medium text-stone-900 dark:text-slate-100">
                          {dev.label}
                          {dev.isCurrentDevice && (
                            <span className="ml-2 text-xs font-normal text-[#1D4ED8] dark:text-[#38BDF8]">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 dark:text-slate-500">
                          {dev.status}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-xs text-stone-600 dark:text-slate-300 whitespace-nowrap">
                    <div>{dev.linkType}</div>
                    {dev.rttMs > 0 && (
                      <div className="font-mono text-stone-400 dark:text-slate-500 tabular-nums">
                        {dev.rttMs} ms RTT
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-stone-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    {dev.bandwidthShareMbps > 0
                      ? `${formatSpeedValue(dev.bandwidthShareMbps, speedUnit)} ${speedUnit}`
                      : '--'}
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="font-mono text-sm font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                      {formatDataVolume(dev.totalBytesUsed)}
                    </div>
                    <div className="font-mono text-xs text-stone-400 dark:text-slate-500 tabular-nums">
                      {dev.usagePct}% of total
                    </div>
                  </td>

                  <td className="py-3 pl-4 text-right font-mono text-sm text-stone-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {dev.estimatedGbPerHour !== null
                      ? `${dev.estimatedGbPerHour.toFixed(1)} GB/hr`
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 border-t border-[#EAE6DD] dark:border-[#1E2942] pt-4 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
          Devices that open Veloxis on your same Wi-Fi / ISP connection appear automatically with measured session data usage. Browser privacy restrictions prevent scanning other local devices that have not opened Veloxis.
        </p>
      </div>

      {/* Card 2: Honest ISP Plan & Region-Based Pricing Benchmark */}
      <div className="overflow-hidden rounded-xl bg-white dark:bg-[#0D1322] vx-card transition-colors duration-200">
        {/* Header & Quick Plan Tier Selector */}
        <div className="border-b border-[#EAE6DD] dark:border-[#1E2942] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="text-base font-semibold text-stone-900 dark:text-slate-50">
                Subscribed ISP Plan &amp; Regional Rate Benchmark
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
                Browsers and IP lookups cannot read your private ISP contract speed (30, 50, 100 Mbps, etc.) or monthly bill automatically. Select a tier or enter your actual plan details manually below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-[#EAE6DD]/75 dark:bg-[#131C31]/75 p-0.5 vx-pill-tray">
              {STANDARD_TIERS_MBPS.map((tierMbps) => {
                const active = profile.subscribedDownloadMbps === tierMbps;
                const label =
                  speedUnit === 'MBps'
                    ? `${Number(convertSpeed(tierMbps, 'MBps').toFixed(1))} MBps`
                    : tierMbps === 1000
                      ? '1 Gbps'
                      : `${tierMbps} Mbps`;
                return (
                  <button
                    key={tierMbps}
                    type="button"
                    onClick={() => handleSelectTier(tierMbps)}
                    className={`relative rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'text-stone-900 dark:text-slate-50 font-semibold'
                        : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="plan-tier-pill"
                        transition={{type: 'spring', stiffness: 460, damping: 34}}
                        className="absolute inset-0 rounded-md vx-pill-active"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Honest Location & Observed-Speed Hint Banner */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-4 py-3 text-xs">
            <div className="flex items-start gap-2 text-stone-600 dark:text-slate-300">
              <Info
                className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                {hasMeasurement && closestTierMbps !== null ? (
                  <span>
                    Measured download is{' '}
                    <span className="font-mono font-semibold text-stone-900 dark:text-slate-100 tabular-nums">
                      {formatSpeedValue(measuredDownloadMbps, speedUnit)} {speedUnit}
                    </span>{' '}
                    (closest standard tier: {closestTierMbps} Mbps /{' '}
                    {Number((closestTierMbps / 8).toFixed(2))} MBps — this cannot verify your contract).
                  </span>
                ) : (
                  <span>
                    Run a speed test or enter your subscribed download speed, optional upload speed, and monthly price in your local currency.
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {hasMeasurement &&
                closestTierMbps !== null &&
                profile.subscribedDownloadMbps !== closestTierMbps && (
                  <button
                    type="button"
                    onClick={() => handleSelectTier(closestTierMbps)}
                    className="rounded-md border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#131C31] px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-slate-100 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Apply {closestTierMbps} Mbps
                  </button>
                )}
              {onRequestFileTest && (
                <button
                  type="button"
                  onClick={onRequestFileTest}
                  className="rounded-md bg-white dark:bg-[#131C31] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#38BDF8] hover:bg-[#EAE6DD]/60 dark:hover:bg-[#1A2540] vx-btn-secondary transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Run Plan File Test
                </button>
              )}
            </div>
          </div>

          {/* Manual Plan & Local Currency Inputs */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="sub-dl-input"
                className="block text-xs font-medium text-stone-600 dark:text-slate-300"
              >
                Subscribed Download ({speedUnit})
              </label>
              <input
                id="sub-dl-input"
                type="number"
                min="0"
                step="any"
                placeholder={speedUnit === 'MBps' ? 'e.g. 12.5' : 'e.g. 100'}
                value={dlInput}
                onChange={(e) => handleDlChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0A101D] px-3 py-2 font-mono text-sm text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:border-[#1D4ED8] dark:focus:border-[#38BDF8] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="sub-ul-input"
                className="block text-xs font-medium text-stone-600 dark:text-slate-300"
              >
                Subscribed Upload ({speedUnit}, optional)
              </label>
              <input
                id="sub-ul-input"
                type="number"
                min="0"
                step="any"
                placeholder={speedUnit === 'MBps' ? 'e.g. 6.25' : 'e.g. 50'}
                value={ulInput}
                onChange={(e) => handleUlChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0A101D] px-3 py-2 font-mono text-sm text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:border-[#1D4ED8] dark:focus:border-[#38BDF8] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="monthly-price-input"
                className="block text-xs font-medium text-stone-600 dark:text-slate-300"
              >
                Monthly Price ({effectiveCurrency})
              </label>
              <input
                id="monthly-price-input"
                type="number"
                min="0"
                step="any"
                placeholder="Enter monthly bill"
                value={priceInput}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0A101D] px-3 py-2 font-mono text-sm text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:border-[#1D4ED8] dark:focus:border-[#38BDF8] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="currency-select"
                className="block text-xs font-medium text-stone-600 dark:text-slate-300"
              >
                Region Currency{' '}
                {networkInfo.currencyCode && !profile.currencyCode
                  ? '(Auto)'
                  : ''}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <select
                  id="currency-select"
                  value={effectiveCurrency}
                  onChange={(e) =>
                    onChangeProfile({...profile, currencyCode: e.target.value})
                  }
                  className="w-full rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0A101D] px-3 py-2 font-mono text-sm text-stone-900 dark:text-slate-100 focus:border-[#1D4ED8] dark:focus:border-[#38BDF8] focus:outline-none"
                >
                  {!CURRENCY_OPTIONS.includes(effectiveCurrency) && (
                    <option value={effectiveCurrency}>
                      {effectiveCurrency}
                    </option>
                  )}
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                {(profile.subscribedDownloadMbps !== null ||
                  profile.subscribedUploadMbps !== null ||
                  profile.monthlyPrice !== null) && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeProfile({
                        planName: '',
                        subscribedDownloadMbps: null,
                        subscribedUploadMbps: null,
                        monthlyPrice: null,
                        currencyCode: networkInfo.currencyCode || '',
                      })
                    }
                    className="rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] px-3 py-2 text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-[#F8F7F4] dark:hover:bg-[#131C31] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {!networkInfo.detected && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Location and local currency could not be detected automatically. Select your regional currency above and enter your local monthly plan rate manually.
            </p>
          )}
        </div>

        {/* Benchmark Metrics Output Band */}
        <div className="border-b border-[#EAE6DD] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D] px-6 py-6 sm:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <div className="text-xs text-stone-500 dark:text-slate-400">
                Plan Delivery
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                  {hasMeasurement && benchmark.downloadDeliveryPct !== null
                    ? `${benchmark.downloadDeliveryPct}%`
                    : '--'}
                </span>
                <span className="font-mono text-xs text-stone-400 dark:text-slate-500 tabular-nums">
                  {profile.subscribedDownloadMbps !== null
                    ? `of ${formatSpeedValue(profile.subscribedDownloadMbps, speedUnit)} ${speedUnit}`
                    : 'enter subscribed speed'}
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EAE6DD] dark:bg-[#1E2942]">
                <motion.div
                  className="h-full bg-[#1D4ED8] dark:bg-[#38BDF8] origin-left"
                  initial={{scaleX: 0}}
                  animate={{
                    scaleX:
                      hasMeasurement && benchmark.downloadDeliveryPct !== null
                        ? clampedDelivery / 100
                        : 0,
                  }}
                  transition={{type: 'spring', stiffness: 220, damping: 26}}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-stone-500 dark:text-slate-400">
                Upload Delivery
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                  {hasMeasurement && benchmark.uploadDeliveryPct !== null
                    ? `${benchmark.uploadDeliveryPct}%`
                    : '--'}
                </span>
                <span className="font-mono text-xs text-stone-400 dark:text-slate-500 tabular-nums">
                  {profile.subscribedUploadMbps !== null
                    ? `of ${formatSpeedValue(profile.subscribedUploadMbps, speedUnit)} ${speedUnit}`
                    : 'enter upload speed'}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-stone-500 dark:text-slate-400">
                {speedUnit === 'MBps'
                  ? 'Cost per 10 MBps'
                  : 'Cost per 100 Mbps'}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                  {unitCostDisplay !== null
                    ? formatCurrency(unitCostDisplay, effectiveCurrency)
                    : '--'}
                </span>
                <span className="font-mono text-xs text-stone-400 dark:text-slate-500">
                  {profile.monthlyPrice !== null
                    ? '/ month'
                    : 'enter monthly price'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby / Regional ISPs & Internet Rate Lookup Band */}
        <div className="bg-[#EAE6DD]/65 dark:bg-[#131C31]/70 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-slate-200">
              <MapPin
                className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0"
                aria-hidden="true"
              />
              <span>
                {locationLabel
                  ? `Regional Network Operators near ${locationLabel}`
                  : 'Regional Network Operators & Local ISP Rates'}
              </span>
            </div>

            <a
              href={rateSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-[#F8F7F4] dark:hover:bg-[#1A2540] transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="h-3 w-3 text-stone-500 dark:text-slate-400" aria-hidden="true" />
              <span>Check local ISP rates online</span>
              <ExternalLink className="h-3 w-3 text-stone-400" aria-hidden="true" />
            </a>
          </div>

          {regionalIsps.available && regionalIsps.operators.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {regionalIsps.operators.map((op, idx) => (
                <motion.div
                  key={`${op.id}-${op.name}`}
                  initial={{opacity: 0, y: 6}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, amount: 0.2}}
                  transition={{
                    duration: 0.24,
                    delay: Math.min(idx * 0.04, 0.24),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{y: -1}}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-800 dark:text-slate-100">
                      {op.name}
                    </div>
                    <div className="truncate text-[11px] text-stone-400 dark:text-slate-500">
                      {[op.city, op.state].filter(Boolean).join(', ') ||
                        regionalIsps.countryCode}
                    </div>
                  </div>
                  {op.website && (
                    <a
                      href={op.website}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Visit ${op.name} website`}
                      className="text-[#1D4ED8] dark:text-[#38BDF8] hover:underline shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
              {regionalIsps.note ||
                'No regional operator directory entries loaded for this IP. Use the search link above to look up current local ISP tariffs and enter your monthly price manually.'}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-stone-500 dark:text-slate-400">
            Live local ISP subscription tariffs are not exposed via public APIs. Click a regional operator or search local rates online to verify pricing in your area, then enter your monthly bill above.
          </p>
        </div>
      </div>
    </section>
  );
};
