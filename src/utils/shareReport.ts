import type {SpeedTestResult, SpeedUnit} from '../types/speedtest';
import {
  evaluateBufferbloat,
  formatDuration,
  formatSpeedValue,
  getScoreLabel,
} from './scoring';

export function formatResultSummaryText(
  result: SpeedTestResult,
  speedUnit: SpeedUnit,
): string {
  const dl = `${formatSpeedValue(result.downloadMbps, speedUnit)} ${speedUnit}`;
  const ul = `${formatSpeedValue(result.uploadMbps, speedUnit)} ${speedUnit}`;
  const bloat =
    result.bufferbloatGrade ??
    evaluateBufferbloat(result.pingMs, result.loadedPingMs).grade;
  const scoreMeta = getScoreLabel(result.veloxisScore);
  const when = new Date(result.timestamp).toLocaleString();

  return [
    `Veloxis Speed Test Report (${when})`,
    `Download: ${dl} | Upload: ${ul}`,
    `Ping: ${result.pingMs.toFixed(0)} ms | Loaded Ping: ${result.loadedPingMs.toFixed(0)} ms | Bufferbloat: ${bloat}`,
    `Jitter: ${result.jitterMs.toFixed(1)} ms | Packet Loss: ${result.packetLossPct.toFixed(1)}%`,
    `Veloxis Score: ${result.veloxisScore}/100 (${scoreMeta.label})`,
    `ISP: ${result.network.isp || 'Unknown'} · Node: ${result.network.serverNode}`,
    result.durationSec !== undefined
      ? `Time Taken: ${formatDuration(result.durationSec)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatComparisonSummaryText(
  runA: SpeedTestResult,
  runB: SpeedTestResult,
  speedUnit: SpeedUnit,
): string {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const dlA = formatSpeedValue(runA.downloadMbps, speedUnit);
  const dlB = formatSpeedValue(runB.downloadMbps, speedUnit);
  const ulA = formatSpeedValue(runA.uploadMbps, speedUnit);
  const ulB = formatSpeedValue(runB.uploadMbps, speedUnit);

  return [
    `Veloxis Run Comparison`,
    `Run A (${fmtDate(runA.timestamp)}): DL ${dlA} ${speedUnit}, UL ${ulA} ${speedUnit}, Ping ${runA.pingMs.toFixed(0)} ms, Score ${runA.veloxisScore}`,
    `Run B (${fmtDate(runB.timestamp)}): DL ${dlB} ${speedUnit}, UL ${ulB} ${speedUnit}, Ping ${runB.pingMs.toFixed(0)} ms, Score ${runB.veloxisScore}`,
  ].join('\n');
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function downloadResultReportPng(
  result: SpeedTestResult,
  speedUnit: SpeedUnit,
  isDark: boolean,
): void {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bg = isDark ? '#0B1120' : '#F8FAFC';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const bandBg = isDark ? '#0F172A' : '#F1F5F9';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const blue = isDark ? '#60A5FA' : '#2563EB';
  const cyan = isDark ? '#22D3EE' : '#0891B2';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer card
  drawRoundedRect(ctx, 48, 44, width - 96, height - 88, 22);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();

  // Header
  ctx.fillStyle = textPrimary;
  ctx.font = '700 32px Inter, system-ui, sans-serif';
  ctx.fillText('Veloxis Speed Test Report', 92, 112);

  const whenStr = new Date(result.timestamp).toLocaleString();
  ctx.fillStyle = textMuted;
  ctx.font = '500 18px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${result.network.isp || 'Connection Telemetry'} · ${result.network.serverNode} · ${whenStr}`,
    92,
    148,
  );

  // Score badge
  const scoreMeta = getScoreLabel(result.veloxisScore);
  drawRoundedRect(ctx, width - 300, 82, 208, 64, 14);
  ctx.fillStyle = bandBg;
  ctx.fill();
  ctx.fillStyle = textMuted;
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('VELOXIS SCORE', width - 278, 108);
  ctx.fillStyle = blue;
  ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `${result.veloxisScore}/100 · ${scoreMeta.label}`,
    width - 278,
    134,
  );

  // Divider
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(92, 180);
  ctx.lineTo(width - 92, 180);
  ctx.stroke();

  // Primary Throughput Row
  ctx.fillStyle = textMuted;
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.fillText('DOWNLOAD SPEED', 92, 232);
  ctx.fillText('UPLOAD SPEED', 610, 232);

  ctx.fillStyle = blue;
  ctx.font = '700 72px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `${formatSpeedValue(result.downloadMbps, speedUnit)}`,
    92,
    314,
  );
  ctx.fillStyle = textMuted;
  ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(speedUnit, 350, 314);

  ctx.fillStyle = cyan;
  ctx.font = '700 72px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `${formatSpeedValue(result.uploadMbps, speedUnit)}`,
    610,
    314,
  );
  ctx.fillStyle = textMuted;
  ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(speedUnit, 868, 314);

  // Metrics Grid Band
  drawRoundedRect(ctx, 92, 366, width - 184, 134, 16);
  ctx.fillStyle = bandBg;
  ctx.fill();

  const bloat = evaluateBufferbloat(result.pingMs, result.loadedPingMs);
  const cols = [
    {label: 'PING', val: `${result.pingMs.toFixed(0)} ms`},
    {label: 'LOADED PING', val: `${result.loadedPingMs.toFixed(0)} ms`},
    {label: 'BUFFERBLOAT', val: `${bloat.grade} (+${bloat.deltaMs.toFixed(0)} ms)`},
    {label: 'JITTER / LOSS', val: `${result.jitterMs.toFixed(1)} ms · ${result.packetLossPct.toFixed(1)}%`},
  ];
  const colW = (width - 184) / cols.length;
  cols.forEach((c, idx) => {
    const cx = 120 + idx * colW;
    ctx.fillStyle = textMuted;
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.fillText(c.label, cx, 412);
    ctx.fillStyle = textPrimary;
    ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(c.val, cx, 456);
  });

  // Footer
  ctx.fillStyle = textMuted;
  ctx.font = '500 16px Inter, system-ui, sans-serif';
  const durText =
    result.durationSec !== undefined
      ? `Duration: ${formatDuration(result.durationSec)} · `
      : '';
  ctx.fillText(
    `${durText}Mode: ${result.mode.toUpperCase()} · Generated by Veloxis`,
    92,
    548,
  );

  const link = document.createElement('a');
  link.download = `veloxis-report-${new Date(result.timestamp).toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function downloadComparisonReportPng(
  runA: SpeedTestResult,
  runB: SpeedTestResult,
  speedUnit: SpeedUnit,
  isDark: boolean,
): void {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bg = isDark ? '#0B1120' : '#F8FAFC';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const bandBg = isDark ? '#0F172A' : '#F1F5F9';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const blue = isDark ? '#60A5FA' : '#2563EB';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 48, 44, width - 96, height - 88, 22);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = textPrimary;
  ctx.font = '700 30px Inter, system-ui, sans-serif';
  ctx.fillText('Veloxis Side-by-Side Comparison', 92, 110);

  const fmt = (iso: string) => new Date(iso).toLocaleString();
  ctx.fillStyle = textMuted;
  ctx.font = '500 17px Inter, system-ui, sans-serif';
  ctx.fillText(`Run A: ${fmt(runA.timestamp)}`, 92, 152);
  ctx.fillStyle = blue;
  ctx.fillText(`Run B: ${fmt(runB.timestamp)}`, 620, 152);

  const rows = [
    {
      label: 'Download',
      a: `${formatSpeedValue(runA.downloadMbps, speedUnit)} ${speedUnit}`,
      b: `${formatSpeedValue(runB.downloadMbps, speedUnit)} ${speedUnit}`,
    },
    {
      label: 'Upload',
      a: `${formatSpeedValue(runA.uploadMbps, speedUnit)} ${speedUnit}`,
      b: `${formatSpeedValue(runB.uploadMbps, speedUnit)} ${speedUnit}`,
    },
    {
      label: 'Ping / Loaded',
      a: `${runA.pingMs.toFixed(0)} / ${runA.loadedPingMs.toFixed(0)} ms`,
      b: `${runB.pingMs.toFixed(0)} / ${runB.loadedPingMs.toFixed(0)} ms`,
    },
    {
      label: 'Veloxis Score',
      a: `${runA.veloxisScore} / 100`,
      b: `${runB.veloxisScore} / 100`,
    },
  ];

  rows.forEach((row, i) => {
    const y = 200 + i * 82;
    drawRoundedRect(ctx, 92, y, width - 184, 66, 12);
    ctx.fillStyle = bandBg;
    ctx.fill();

    ctx.fillStyle = textMuted;
    ctx.font = '600 18px Inter, system-ui, sans-serif';
    ctx.fillText(row.label, 122, y + 40);

    ctx.fillStyle = textPrimary;
    ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(row.a, 440, y + 40);
    ctx.fillStyle = blue;
    ctx.fillText(row.b, 800, y + 40);
  });

  ctx.fillStyle = textMuted;
  ctx.font = '500 16px Inter, system-ui, sans-serif';
  ctx.fillText('Generated by Veloxis Connection Telemetry', 92, 554);

  const link = document.createElement('a');
  link.download = `veloxis-comparison-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
