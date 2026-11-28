import type {SpeedTestResult, SpeedUnit} from '../types/speedtest';
import {
  convertSpeed,
  evaluateBufferbloat,
  formatDuration,
  formatSpeedValue,
  getScoreLabel,
  speedToNormalized,
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
    `Veloxis Speed Test (${when})`,
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

function drawGaugeArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: string,
  lineWidth: number,
) {
  if (endAngle <= startAngle) return;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawCircularMetric(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    radius: number;
    strokeWidth: number;
    progress: number;
    trackColor: string;
    strokeColor: string;
    valueText: string;
    unitText: string;
    label: string;
    subtitle: string;
    subtitleColor: string;
    textPrimary: string;
    textLabel: string;
    textMuted: string;
  },
) {
  const {
    cx,
    cy,
    radius,
    strokeWidth,
    progress,
    trackColor,
    strokeColor,
    valueText,
    unitText,
    label,
    subtitle,
    subtitleColor,
    textPrimary,
    textLabel,
    textMuted,
  } = opts;

  const clamped = Math.max(0, Math.min(1, progress));
  const topAngle = -Math.PI / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (clamped > 0.005) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, topAngle, topAngle + Math.PI * 2 * clamped);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = textPrimary;
  ctx.font = '700 28px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(valueText, cx, cy - 8);

  ctx.fillStyle = textMuted;
  ctx.font = '600 12px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(unitText, cx, cy + 16);

  ctx.fillStyle = textLabel;
  ctx.font = '600 14px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText(label, cx, cy + radius + 24);

  ctx.fillStyle = subtitleColor;
  ctx.font = '600 12px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText(subtitle, cx, cy + radius + 43);
}

export function renderResultSnapshotDataUrl(
  result: SpeedTestResult,
  speedUnit: SpeedUnit,
  isDark: boolean,
): string | null {
  const width = 1200;
  const height = 560;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(dpr, dpr);

  const bg = isDark ? '#070B14' : '#FAF9F6';
  const cardBg = isDark ? '#0D1322' : '#FFFFFF';
  const bandBg = isDark ? '#0A101D' : '#F8F7F4';
  const footerBg = isDark ? 'rgba(19, 28, 49, 0.7)' : 'rgba(234, 230, 221, 0.55)';
  const hairline = isDark ? 'rgba(255, 255, 255, 0.10)' : '#DFDAD0';
  const topHighlight = isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF';
  const trackBg = isDark ? '#1E2942' : '#EAE6DD';
  const tickColor = isDark ? '#334155' : '#D6D0C4';

  const textPrimary = isDark ? '#F8FAFC' : '#1C1917';
  const textSecondary = isDark ? '#CBD5E1' : '#57534E';
  const textMuted = isDark ? '#94A3B8' : '#78716C';

  const blue = isDark ? '#38BDF8' : '#1D4ED8';
  const lime = isDark ? '#A3E635' : '#65A30D';
  const scoreMeta = getScoreLabel(result.veloxisScore);
  const scoreColorMap = {
    emerald: isDark ? '#34D399' : '#059669',
    blue,
    amber: isDark ? '#FBBF24' : '#D97706',
    rose: isDark ? '#FB7185' : '#E11D48',
  } as const;
  const scoreColor = scoreColorMap[scoreMeta.tone];

  // Outer backdrop
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Main Card Shell
  const cardX = 36;
  const cardY = 36;
  const cardW = width - 72;
  const cardH = height - 72;
  const splitX = cardX + 440;

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.clip();

  // Card background
  ctx.fillStyle = cardBg;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Right panel lower telemetry band background
  const bandY = cardY + 296;
  const footerY = cardY + cardH - 52;
  ctx.fillStyle = bandBg;
  ctx.fillRect(splitX, bandY, cardX + cardW - splitX, footerY - bandY);

  // Right panel footer strip
  ctx.fillStyle = footerBg;
  ctx.fillRect(splitX, footerY, cardX + cardW - splitX, cardY + cardH - footerY);

  // Hairline dividers
  ctx.strokeStyle = hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(splitX, cardY);
  ctx.lineTo(splitX, cardY + cardH);
  ctx.moveTo(splitX, bandY);
  ctx.lineTo(cardX + cardW, bandY);
  ctx.moveTo(splitX, footerY);
  ctx.lineTo(cardX + cardW, footerY);
  ctx.stroke();

  // Crisp 1px top highlight line
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, topHighlight);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY + 0.5, cardW, 1.5);

  ctx.restore();

  // Hairline border around card
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = hairline;
  ctx.stroke();

  // --- LEFT PANEL: MAIN PRECISION GAUGE CIRCLE ---
  const gaugeCx = cardX + 220;
  const gaugeCy = cardY + 244;
  const mainR = 120;
  const dlR = 136;
  const ulR = 145;
  const startAngle = (150 * Math.PI) / 180;
  const totalSweep = (240 * Math.PI) / 180;
  const endAngle = startAngle + totalSweep;

  const avgSpeedMbps = (result.downloadMbps + result.uploadMbps) / 2;
  const dlNorm = speedToNormalized(result.downloadMbps);
  const ulNorm = speedToNormalized(result.uploadMbps);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textSecondary;
  ctx.font = '500 13px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText('Measurement Complete', gaugeCx, cardY + 52);

  // Outer Lime Upload progress arc
  drawGaugeArc(ctx, gaugeCx, gaugeCy, ulR, startAngle, endAngle, trackBg, 3.5);
  drawGaugeArc(
    ctx,
    gaugeCx,
    gaugeCy,
    ulR,
    startAngle,
    startAngle + totalSweep * ulNorm,
    lime,
    3.5,
  );

  // Outer Blue Download progress arc
  drawGaugeArc(ctx, gaugeCx, gaugeCy, dlR, startAngle, endAngle, trackBg, 3.5);
  drawGaugeArc(
    ctx,
    gaugeCx,
    gaugeCy,
    dlR,
    startAngle,
    startAngle + totalSweep * dlNorm,
    blue,
    3.5,
  );

  // Main 3rd inner track arc (resets to 0 after score is calculated)
  drawGaugeArc(ctx, gaugeCx, gaugeCy, mainR, startAngle, endAngle, trackBg, 11);

  // Tick marks
  const tickMarks =
    speedUnit === 'MBps'
      ? [
          {mbps: 0, label: '0'},
          {mbps: 8, label: '1'},
          {mbps: 40, label: '5'},
          {mbps: 100, label: '12.5'},
          {mbps: 240, label: '30'},
          {mbps: 500, label: '62.5'},
          {mbps: 1000, label: '125'},
        ]
      : [
          {mbps: 0, label: '0'},
          {mbps: 10, label: '10'},
          {mbps: 50, label: '50'},
          {mbps: 100, label: '100'},
          {mbps: 250, label: '250'},
          {mbps: 500, label: '500'},
          {mbps: 1000, label: '1G'},
        ];

  tickMarks.forEach((mark) => {
    const norm = speedToNormalized(mark.mbps);
    const ang = startAngle + totalSweep * norm;
    const x1 = gaugeCx + (mainR - 17) * Math.cos(ang);
    const y1 = gaugeCy + (mainR - 17) * Math.sin(ang);
    const x2 = gaugeCx + (mainR - 11) * Math.cos(ang);
    const y2 = gaugeCy + (mainR - 11) * Math.sin(ang);
    const lx = gaugeCx + (mainR - 31) * Math.cos(ang);
    const ly = gaugeCy + (mainR - 31) * Math.sin(ang);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = tickColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = textMuted;
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(mark.label, lx, ly);
  });

  // Main gauge center readout (Avg DL + UL)
  const avgVal = convertSpeed(avgSpeedMbps, speedUnit);
  const avgText =
    speedUnit === 'MBps'
      ? avgVal < 10
        ? avgVal.toFixed(2)
        : avgVal.toFixed(1)
      : avgVal >= 100
        ? avgVal.toFixed(0)
        : avgVal.toFixed(1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 48px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const numW = ctx.measureText(avgText).width;
  ctx.font = '600 13px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const unitW = ctx.measureText(speedUnit).width;
  const totalTextW = numW + 7 + unitW;
  const numStartX = gaugeCx - totalTextW / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = textPrimary;
  ctx.font = '700 48px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(avgText, numStartX, gaugeCy + 4);

  ctx.fillStyle = textMuted;
  ctx.font = '600 13px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(speedUnit, numStartX + numW + 7, gaugeCy + 4);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textMuted;
  ctx.font = '600 11.5px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('Avg (DL + UL)', gaugeCx, gaugeCy + 28);

  // Legend dots under Avg (DL + UL)
  ctx.fillStyle = blue;
  drawRoundedRect(ctx, gaugeCx - 74, gaugeCy + 48, 12, 5, 2.5);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = textSecondary;
  ctx.font = '500 11.5px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText('Download', gaugeCx - 57, gaugeCy + 51);

  ctx.fillStyle = lime;
  drawRoundedRect(ctx, gaugeCx + 14, gaugeCy + 48, 12, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = textSecondary;
  ctx.fillText('Upload', gaugeCx + 31, gaugeCy + 51);

  // Subtle time taken under gauge
  if (result.durationSec !== undefined) {
    ctx.textAlign = 'center';
    ctx.fillStyle = textMuted;
    ctx.font = '500 12px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(
      `Time Taken ${formatDuration(result.durationSec)}`,
      gaugeCx,
      cardY + cardH - 34,
    );
  }

  // --- RIGHT PANEL TOP BAND: THREE STATUS CIRCLES ---
  const rightW = cardX + cardW - splitX;
  const colCenter = (idx: number) => splitX + (rightW / 3) * (idx + 0.5);
  const circleCy = cardY + 132;
  const circleR = 64;

  const dlVal = convertSpeed(result.downloadMbps, speedUnit);
  const dlStr =
    speedUnit === 'MBps'
      ? dlVal < 10
        ? dlVal.toFixed(2)
        : dlVal.toFixed(1)
      : dlVal >= 100
        ? dlVal.toFixed(0)
        : dlVal.toFixed(1);

  const ulVal = convertSpeed(result.uploadMbps, speedUnit);
  const ulStr =
    speedUnit === 'MBps'
      ? ulVal < 10
        ? ulVal.toFixed(2)
        : ulVal.toFixed(1)
      : ulVal >= 100
        ? ulVal.toFixed(0)
        : ulVal.toFixed(1);

  drawCircularMetric(ctx, {
    cx: colCenter(0),
    cy: circleCy,
    radius: circleR,
    strokeWidth: 8.5,
    progress: dlNorm,
    trackColor: trackBg,
    strokeColor: blue,
    valueText: dlStr,
    unitText: speedUnit,
    label: 'Download',
    subtitle: 'Measured',
    subtitleColor: blue,
    textPrimary,
    textLabel: textPrimary,
    textMuted,
  });

  drawCircularMetric(ctx, {
    cx: colCenter(1),
    cy: circleCy,
    radius: circleR,
    strokeWidth: 7,
    progress: result.veloxisScore / 100,
    trackColor: trackBg,
    strokeColor: scoreColor,
    valueText: `${result.veloxisScore}`,
    unitText: '/ 100',
    label: 'Veloxis Score',
    subtitle: scoreMeta.label,
    subtitleColor: scoreColor,
    textPrimary,
    textLabel: textSecondary,
    textMuted,
  });

  drawCircularMetric(ctx, {
    cx: colCenter(2),
    cy: circleCy,
    radius: circleR,
    strokeWidth: 8.5,
    progress: ulNorm,
    trackColor: trackBg,
    strokeColor: lime,
    valueText: ulStr,
    unitText: speedUnit,
    label: 'Upload',
    subtitle: 'Measured',
    subtitleColor: lime,
    textPrimary,
    textLabel: textPrimary,
    textMuted,
  });

  // --- RIGHT PANEL MIDDLE BAND: PING, LOADED PING, JITTER, PACKET LOSS ---
  const telemetryPadX = splitX + 38;
  const telemetryUsableW = rightW - 76;
  const telemetryMetrics = [
    {label: 'Ping', value: `${result.pingMs.toFixed(0)}`, unit: 'ms'},
    {label: 'Loaded Ping', value: `${result.loadedPingMs.toFixed(0)}`, unit: 'ms'},
    {label: 'Jitter', value: `${result.jitterMs.toFixed(1)}`, unit: 'ms'},
    {label: 'Packet Loss', value: `${result.packetLossPct.toFixed(1)}`, unit: '%'},
  ];

  telemetryMetrics.forEach((m, idx) => {
    const mx = telemetryPadX + (telemetryUsableW / 4) * idx;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = textMuted;
    ctx.font = '500 13px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(m.label, mx, bandY + 46);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textPrimary;
    ctx.font = '700 30px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    const valW = ctx.measureText(m.value).width;
    ctx.fillText(m.value, mx, bandY + 94);

    ctx.fillStyle = textMuted;
    ctx.font = '500 13px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(m.unit, mx + valW + 5, bandY + 94);
  });

  // --- RIGHT PANEL FOOTER STRIP ---
  const whenStr = new Date(result.timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = textMuted;
  ctx.font = '500 12.5px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const durationPrefix =
    result.durationSec !== undefined
      ? `Completed in ${formatDuration(result.durationSec)} · `
      : '';
  ctx.fillText(`${durationPrefix}${whenStr}`, splitX + 38, footerY + 26);

  ctx.textAlign = 'right';
  const netLabel = `${result.network.isp || 'Connection'} · ${result.network.serverNode}`;
  ctx.fillText(netLabel, cardX + cardW - 38, footerY + 26, Math.max(180, rightW - 320));

  return canvas.toDataURL('image/png');
}

export function getSnapshotFilename(timestamp: string): string {
  return `veloxis-speedtest-${new Date(timestamp).toISOString().slice(0, 10)}.png`;
}

export function triggerPngDownload(dataUrl: string, timestamp: string): void {
  const link = document.createElement('a');
  link.download = getSnapshotFilename(timestamp);
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadResultReportPng(
  result: SpeedTestResult,
  speedUnit: SpeedUnit,
  isDark: boolean,
): void {
  const dataUrl = renderResultSnapshotDataUrl(result, speedUnit, isDark);
  if (!dataUrl) return;
  triggerPngDownload(dataUrl, result.timestamp);
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
