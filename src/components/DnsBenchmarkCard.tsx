import React, {useCallback, useEffect, useState} from 'react';
import {RefreshCw, Server} from 'lucide-react';
import {motion} from 'motion/react';
import type {DnsBenchmarkEntry} from '../types/speedtest';

async function measureDoH(
  id: string,
  name: string,
  ip: string,
  url: string,
): Promise<DnsBenchmarkEntry> {
  // Warm up TLS once if needed, then time actual DNS query resolution
  try {
    const t0 = performance.now();
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {Accept: 'application/dns-json'},
      signal: AbortSignal.timeout(2800),
    });
    if (!res.ok) throw new Error('DNS probe failed');
    await res.json();
    const ms = Math.max(1, Number((performance.now() - t0).toFixed(1)));
    const status = ms <= 35 ? 'Fast' : ms <= 90 ? 'Average' : 'Slow';
    return {id, name, ip, latencyMs: ms, status};
  } catch {
    return {id, name, ip, latencyMs: null, status: 'Unavailable'};
  }
}

export const DnsBenchmarkCard: React.FC = () => {
  const [entries, setEntries] = useState<DnsBenchmarkEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDnsBenchmark = useCallback(async () => {
    setIsRunning(true);
    const systemProbe = async (): Promise<DnsBenchmarkEntry> => {
      try {
        const res = await fetch(`/api/dns-benchmark/system?t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(2500),
        });
        if (!res.ok) throw new Error('System DNS failed');
        const data = (await res.json()) as {
          ok: boolean;
          latencyMs: number | null;
        };
        if (!data.ok || data.latencyMs === null) {
          return {
            id: 'isp-system',
            name: 'System / ISP DNS',
            ip: 'Local Host',
            latencyMs: null,
            status: 'Unavailable',
          };
        }
        const status =
          data.latencyMs <= 35
            ? 'Fast'
            : data.latencyMs <= 90
              ? 'Average'
              : 'Slow';
        return {
          id: 'isp-system',
          name: 'System / ISP DNS',
          ip: 'Local Host',
          latencyMs: data.latencyMs,
          status,
        };
      } catch {
        return {
          id: 'isp-system',
          name: 'System / ISP DNS',
          ip: 'Local Host',
          latencyMs: null,
          status: 'Unavailable',
        };
      }
    };

    const results = await Promise.all([
      measureDoH(
        'cloudflare',
        'Cloudflare',
        '1.1.1.1',
        `https://cloudflare-dns.com/dns-query?name=example.com&type=A&_=${Date.now()}`,
      ),
      measureDoH(
        'google',
        'Google Public DNS',
        '8.8.8.8',
        `https://dns.google/resolve?name=example.com&type=A&_=${Date.now()}`,
      ),
      measureDoH(
        'quad9',
        'Quad9 Security',
        '9.9.9.9',
        `https://dns.quad9.net:5053/dns-query?name=example.com&type=A&_=${Date.now()}`,
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

  const maxMs = Math.max(
    60,
    ...entries.map((e) => e.latencyMs ?? 0),
  );
  const fastest = entries.find((e) => e.latencyMs !== null) ?? null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Server
            className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              DNS Resolver Speed Benchmark
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fastest
                ? `Fastest lookup: ${fastest.name} (${fastest.ip}) at ${fastest.latencyMs?.toFixed(1)} ms`
                : 'Live DNS-over-HTTPS and system resolver response benchmark'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={runDnsBenchmark}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`}
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
            entry.status === 'Fast'
              ? 'text-emerald-700 dark:text-emerald-400'
              : entry.status === 'Average'
                ? 'text-blue-700 dark:text-blue-400'
                : entry.status === 'Slow'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-400 dark:text-slate-500';

          return (
            <div
              key={entry.id}
              className={`rounded-lg border p-3.5 text-xs transition-colors ${
                isBest
                  ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {entry.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    {entry.ip}
                  </div>
                </div>
                <span className={`font-semibold whitespace-nowrap ${statusColor}`}>
                  {isBest ? 'Fastest' : entry.status}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                  {entry.latencyMs !== null ? `${entry.latencyMs.toFixed(1)} ms` : '--'}
                </span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  #{idx + 1}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  className={`h-full origin-left ${
                    isBest
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : 'bg-blue-600 dark:bg-blue-500'
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
    </div>
  );
};
