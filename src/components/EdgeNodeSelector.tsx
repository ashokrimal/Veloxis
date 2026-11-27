import React from 'react';
import {Globe, RefreshCw} from 'lucide-react';
import type {EdgeNode} from '../types/speedtest';

interface EdgeNodeSelectorProps {
  nodes: EdgeNode[];
  selectedNodeId: string; // 'auto' or specific node id
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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs transition-colors duration-200">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
        <span className="font-medium whitespace-nowrap">Test Server:</span>
      </div>

      <select
        aria-label="Select edge test server node"
        disabled={disabled}
        value={selectedNodeId}
        onChange={(e) => onSelectNode(e.target.value)}
        className="max-w-[230px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60 cursor-pointer"
      >
        <option value="auto">
          Auto · Lowest Ping
          {effectiveNode?.rttMs !== null && effectiveNode?.rttMs !== undefined
            ? ` (${effectiveNode.label.split('·')[0].trim()} · ${Math.round(effectiveNode.rttMs)} ms)`
            : ''}
        </option>
        {nodes.map((node) => (
          <option key={node.id} value={node.id} disabled={!node.available}>
            {node.label}
            {node.rttMs !== null
              ? ` · ${Math.round(node.rttMs)} ms`
              : ' · Unreachable'}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={isProbing || disabled}
        onClick={onReprobe}
        title="Re-probe server node latency"
        aria-label="Re-probe edge server latency"
        className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw
          className={`h-3 w-3 ${isProbing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{isProbing ? 'Probing' : 'Probe'}</span>
      </button>
    </div>
  );
};
