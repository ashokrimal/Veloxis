import React from 'react';
import {Globe, RefreshCw} from 'lucide-react';
import type {EdgeNode} from '../types/speedtest';

interface EdgeNodeSelectorProps {
  nodes: EdgeNode[];
  selectedNodeId: string;
  effectiveNode: EdgeNode | null;
  isProbing: boolean;
  disabled?: boolean;
  onSelectNode: (nodeId: string) => void;
  onReprobe: () => void;
}

export const EdgeNodeSelector: React.FC<EdgeNodeSelectorProps> = ({
  nodes,
  selectedNodeId,
  effectiveNode,
  isProbing,
  disabled = false,
  onSelectNode,
  onReprobe,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-stone-500 dark:text-slate-400">
        <Globe
          className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0"
          aria-hidden="true"
        />
        <span className="font-medium whitespace-nowrap">Server</span>
      </div>

      <select
        aria-label="Select edge test server node"
        disabled={disabled}
        value={selectedNodeId}
        onChange={(e) => onSelectNode(e.target.value)}
        className="max-w-[260px] rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-2.5 py-1.5 text-xs font-medium text-stone-900 dark:text-slate-100 focus:border-[#1D4ED8] dark:focus:border-[#38BDF8] focus:outline-none disabled:opacity-60 cursor-pointer transition-colors duration-150"
      >
        <option value="auto">
          Auto · Lowest Ping
          {effectiveNode?.rttMs !== null && effectiveNode?.rttMs !== undefined
            ? ` (${effectiveNode.label.split('·')[0].trim()} · ${Math.round(effectiveNode.rttMs)} ms)`
            : ''}
        </option>
        {nodes.map((node) => {
          const dist =
            typeof node.distanceKm === 'number' ? ` · ~${node.distanceKm} km` : '';
          const ping =
            node.rttMs !== null ? ` · ${Math.round(node.rttMs)} ms` : ' · Unreachable';
          return (
            <option key={node.id} value={node.id} disabled={!node.available}>
              {node.label}
              {dist}
              {ping}
            </option>
          );
        })}
      </select>

      <button
        type="button"
        disabled={isProbing || disabled}
        onClick={onReprobe}
        title="Re-probe server node latency"
        aria-label="Re-probe edge server latency"
        className="inline-flex items-center gap-1 rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-white dark:bg-[#0D1322] px-2.5 py-1.5 text-[11px] font-medium text-stone-700 dark:text-slate-300 hover:bg-[#F8F7F4] dark:hover:bg-[#131C31] disabled:opacity-50 cursor-pointer transition-colors duration-150"
      >
        <RefreshCw
          className={`h-3 w-3 ${isProbing ? 'animate-spin text-[#1D4ED8] dark:text-[#38BDF8]' : ''}`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{isProbing ? 'Probing' : 'Probe'}</span>
      </button>
    </div>
  );
};
