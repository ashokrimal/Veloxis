import React from 'react';
import {AlertTriangle, CheckCircle2, Gamepad2, Globe, Tv} from 'lucide-react';
import type {ActivityVerdict, VerdictTier} from '../types/speedtest';

interface ActivityDiagnosticsProps {
  activities: ActivityVerdict[] | null;
  isTesting: boolean;
}

function getTierStyles(tier: VerdictTier) {
  switch (tier) {
    case 'Optimal':
      return {
        text: 'text-emerald-700',
        Icon: CheckCircle2,
      };
    case 'Good':
      return {
        text: 'text-blue-700',
        Icon: CheckCircle2,
      };
    case 'Fair':
      return {
        text: 'text-amber-700',
        Icon: AlertTriangle,
      };
    default:
      return {
        text: 'text-rose-700',
        Icon: AlertTriangle,
      };
  }
}

function getActivityIcon(id: ActivityVerdict['id']) {
  switch (id) {
    case 'streaming':
      return Tv;
    case 'gaming':
      return Gamepad2;
    default:
      return Globe;
  }
}

export const ActivityDiagnostics: React.FC<ActivityDiagnosticsProps> = ({
  activities,
  isTesting,
}) => {
  if (!activities) {
    return (
      <section aria-label="Activity readiness diagnostics" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {title: '4K & HD Streaming', desc: 'Evaluates sustained download bandwidth and jitter buffer margin.'},
          {title: 'Online Gaming', desc: 'Evaluates unloaded ping, loaded latency spike, and packet stability.'},
          {title: 'Browsing & Video Calls', desc: 'Evaluates symmetric upload headroom and response snappiness.'},
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <span className="text-xs font-mono text-slate-400">
                {isTesting ? 'Measuring...' : 'Pending'}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.desc}</p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Activity readiness diagnostics"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      {activities.map((act) => {
        const {text, Icon} = getTierStyles(act.tier);
        const CategoryIcon = getActivityIcon(act.id);

        return (
          <div
            key={act.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <CategoryIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{act.title}</h3>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${text}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{act.tier}</span>
                </span>
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                {act.summary}
              </p>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">{act.metricLabel}</span>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {act.metricValue}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
};
