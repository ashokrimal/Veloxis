import React, {useCallback, useEffect, useState} from 'react';
import {Check, Copy, RefreshCw, Server} from 'lucide-react';
import {motion} from 'motion/react';
import type {DnsBenchmarkEntry} from '../types/speedtest';

const BENCHMARK_DOMAINS = ['example.com', 'iana.org', 'cloudflare.com'];

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
    : sorted[mid];
}

function classifyLatency(ms: number): DnsBenchmarkEntry['status'] {
  if (ms <= 35) return 'Fast';
  if (ms <= 90) return 'Average';
  return 'Slow';
}

async function queryDoHOnce(url: string): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {Accept: 'application/dns-json'},
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error('DNS probe failed');
  await res.json();
  return Math.max(1, Number((performance.now() - t0).toFixed(1)));
}

async function measureDoHMultiSample(
  id: string,
  name: string,
  ip: string,
  buildUrl: (domain: string, nonce: string) => string,
  fallbackBuildUrl?: (domain: string, nonce: string) => string,
): Promise<DnsBenchmarkEntry> {
  let activeBuilder = buildUrl;

  // 1. Warm up TLS/HTTP2 socket so handshake cold-start doesn't skew lookup timing
  try {
    await queryDoHOnce(activeBuilder('example.com', `warm_${Date.now()}`));
  } catch {
    if (fallbackBuildUrl) {
      try {
        await queryDoHOnce(
          fallbackBuildUrl('example.com', `warm_${Date.now()}`),
        );
        activeBuilder = fallbackBuildUrl;
      } catch {
        return {
          id,
          name,
          ip,
          latencyMs: null,
          minMs: null,
          maxMs: null,
          sampleCount: 0,
          protocol: 'DoH',
          status: 'Unavailable',
        };
      }
    } else {
      return {
        id,
        name,
        ip,
        latencyMs: null,
        minMs: null,
        maxMs: null,
        sampleCount: 0,
        protocol: 'DoH',
        status: 'Unavailable',
      };
    }
  }

  // 2. Measure 3 sequential lookups across distinct domains
  const samples: number[] = [];
  for (let i = 0; i < BENCHMARK_DOMAINS.length; i++) {
    const domain = BENCHMARK_DOMAINS[i];
    try {
      const ms = await queryDoHOnce(
        activeBuilder(domain, `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`),
      );
      samples.push(ms);
    } catch {
      // Skip failed individual sample
    }
  }

  if (samples.length === 0) {
    return {
      id,
      name,
      ip,
      latencyMs: null,
      minMs: null,
      maxMs: null,
      sampleCount: 0,
      protocol: 'DoH',
      status: 'Unavailable',
    };
  }

  const medianMs = computeMedian(samples);
  return {
    id,
    name,
    ip,
    latencyMs: medianMs,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    sampleCount: samples.length,
    protocol: 'DoH',
    status: classifyLatency(medianMs),
  };
}

export const DnsBenchmarkCard: React.FC = () => {
  const [entries, setEntries] = useState<DnsBenchmarkEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runDnsBenchmark = useCallback(async () => {
    setIsRunning(true);

    const systemProbe = async (): Promise<DnsBenchmarkEntry> => {
      try {
        const res = await fetch(`/api/dns-benchmark/system?t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) throw new Error('System DNS failed');
        const data = (await res.json()) as {
          ok: boolean;
          ip?: string;
          latencyMs: number | null;
          minMs?: number | null;
          maxMs?: number | null;
          sampleCount?: number;
        };
        if (!data.ok || data.latencyMs === null) {
          return {
            id: 'isp-system',
            name: 'ISP / System Default',
            ip: data.ip || 'Auto DNS',
            latencyMs: null,
            minMs: null,
            maxMs: null,
            sampleCount: 0,
            protocol: 'System DNS',
            status: 'Unavailable',
          };
        }
        return {
          id: 'isp-system',
          name: 'ISP / System Default',
          ip: data.ip || 'Auto DNS',
          latencyMs: data.latencyMs,
          minMs: data.minMs ?? data.latencyMs,
          maxMs: data.maxMs ?? data.latencyMs,
          sampleCount: data.sampleCount ?? 3,
          protocol: 'System DNS',
          status: classifyLatency(data.latencyMs),
        };
      } catch {
        return {
          id: 'isp-system',
          name: 'ISP / System Default',
          ip: 'Auto DNS',
          latencyMs: null,
          minMs: null,
          maxMs: null,
          sampleCount: 0,
          protocol: 'System DNS',
          status: 'Unavailable',
        };
      }
    };

    const results = await Promise.all([
      measureDoHMultiSample(
        'cloudflare',
        'Cloudflare',
        '1.1.1.1',
        (domain, nonce) =>
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A&_=${nonce}`,
      ),
      measureDoHMultiSample(
        'google',
        'Google Public DNS',
        '8.8.8.8',
        (domain, nonce) =>
          `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A&_=${nonce}`,
      ),
      measureDoHMultiSample(
        'quad9',
        'Quad9 Security',
        '9.9.9.9',
        (domain, nonce) =>
          `https://dns.quad9.net/dns-query?name=${encodeURIComponent(domain)}&type=A&_=${nonce}`,
        (domain, nonce) =>
          `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(domain)}&type=A&_=${nonce}`,
      ),
      systemProbe(),
    ]);

    results.sort((a, b) => {
      if (a.latencyMs === null && b.latencyMs === null) return 0;
      if (a.latencyMs === null) return 1;
      if (b.latencyMs === null) return -1;
      return a.latencyMs - b.latencyMs;
    });

    setEntries(results);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    void runDnsBenchmark();
  }, [runDnsBenchmark]);

  const handleCopyIp = async (id: string, ip: string) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const maxMs = Math.max(60, ...entries.map((e) => e.latencyMs ?? 0));
  const fastest = entries.find((e) => e.latencyMs !== null) ?? null;
  const ispEntry = entries.find((e) => e.id === 'isp-system') ?? null;
  const deltaVsIsp =
    fastest &&
    fastest.id !== 'isp-system' &&
    fastest.latencyMs !== null &&
    ispEntry?.latencyMs !== null &&
    ispEntry?.latencyMs !== undefined &&
    ispEntry.latencyMs > fastest.latencyMs
      ? Number((ispEntry.latencyMs - fastest.latencyMs).toFixed(1))
      : null;

  return (
    <section
      aria-label="DNS resolver performance benchmark"
      className="rounded-xl bg-white dark:bg-[#0D1322] p-6 vx-card transition-colors duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <Server
            className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-50">
              DNS Resolver Performance Benchmark
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
              {isRunning && entries.length === 0
                ? 'Warming TLS sockets and timing 3 uncached lookups per resolver...'
                : fastest
                  ? deltaVsIsp !== null
                    ? `Fastest: ${fastest.name} (${fastest.ip}) at ${fastest.latencyMs?.toFixed(1)} ms median — ${deltaVsIsp} ms faster than ISP default`
                    : `Fastest lookup: ${fastest.name} (${fastest.ip}) at ${fastest.latencyMs?.toFixed(1)} ms median`
                  : '3-sample median lookup comparison across Cloudflare, Google, Quad9, and ISP default'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => void runDnsBenchmark()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8F7F4] dark:bg-[#131C31] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-[#EAE6DD] dark:hover:bg-[#1E2942] vx-btn-secondary disabled:opacity-60 cursor-pointer shrink-0"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin text-[#1D4ED8] dark:text-[#38BDF8]' : ''}`}
            aria-hidden="true"
          />
          <span>{isRunning ? 'Benchmarking...' : 'Re-test DNS'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map((entry, idx) => {
          const ratio =
            entry.latencyMs !== null
              ? Math.min(1, Math.max(0.08, entry.latencyMs / maxMs))
              : 0;
          const isBest = fastest?.id === entry.id;
          const statusColor =
            isBest
              ? 'text-emerald-700 dark:text-emerald-400'
              : entry.status === 'Fast'
                ? 'text-emerald-700 dark:text-emerald-400'
                : entry.status === 'Average'
                  ? 'text-[#1D4ED8] dark:text-[#38BDF8]'
                  : entry.status === 'Slow'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-stone-400 dark:text-slate-500';
          const canCopyIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(entry.ip);

          return (
            <div
              key={entry.id}
              className={`rounded-lg border p-3.5 text-xs transition-colors ${
                isBest
                  ? 'border-emerald-300/80 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/25'
                  : 'border-[#DFDAD0] dark:border-[#1E2942] bg-[#F8F7F4] dark:bg-[#0A101D]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-stone-900 dark:text-slate-100">
                    {entry.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-stone-500 dark:text-slate-400">
                    <span className="truncate">{entry.ip}</span>
                    {canCopyIp && (
                      <button
                        type="button"
                        onClick={() => void handleCopyIp(entry.id, entry.ip)}
                        title={`Copy ${entry.ip}`}
                        aria-label={`Copy ${entry.name} IP ${entry.ip}`}
                        className="text-stone-400 hover:text-stone-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
                      >
                        {copiedId === entry.id ? (
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <span className={`font-semibold whitespace-nowrap shrink-0 ${statusColor}`}>
                  {isBest ? 'Fastest' : entry.status}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-bold text-stone-900 dark:text-slate-50 tabular-nums">
                  {entry.latencyMs !== null ? `${entry.latencyMs.toFixed(1)} ms` : '--'}
                </span>
                <span className="font-mono text-[10px] text-stone-400 dark:text-slate-500 whitespace-nowrap">
                  #{idx + 1} · {entry.protocol || 'DoH'}
                </span>
              </div>

              <div className="mt-1 font-mono text-[10px] text-stone-500 dark:text-slate-400 tabular-nums">
                {entry.minMs !== null &&
                entry.minMs !== undefined &&
                entry.maxMs !== null &&
                entry.maxMs !== undefined &&
                entry.sampleCount
                  ? `Range ${entry.minMs.toFixed(1)}–${entry.maxMs.toFixed(1)} ms (${entry.sampleCount} runs)`
                  : 'Probe unreachable from this network'}
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EAE6DD] dark:bg-[#1E2942]">
                <motion.div
                  className={`h-full origin-left ${
                    isBest
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : 'bg-[#1D4ED8] dark:bg-[#38BDF8]'
                  }`}
                  initial={{scaleX: 0}}
                  animate={{scaleX: ratio}}
                  transition={{type: 'spring', stiffness: 220, damping: 26}}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
