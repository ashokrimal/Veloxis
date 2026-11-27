import express from 'express';
import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Pre-allocate a 1 MB high-entropy buffer once so download streams run at wire speed
// without CPU bottlenecks or proxy compression distortion.
const CHUNK_SIZE = 1024 * 1024;
const RANDOM_CHUNK = crypto.randomBytes(CHUNK_SIZE);

interface NetworkLookupResponse {
  ip: string;
  isp: string;
  asn: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  currencyCode: string;
  serverNode: string;
  detected: boolean;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp.trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '');
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)
  );
}

async function lookupNetworkInfo(clientIp: string): Promise<NetworkLookupResponse> {
  const cleanIp = clientIp.replace(/^::ffff:/, '');
  const ipApiEndpoint = isPrivateIp(cleanIp)
    ? 'http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,currency,isp,org,as,query'
    : `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,countryCode,regionName,city,currency,isp,org,as,query`;

  try {
    const res = await fetch(ipApiEndpoint, {
      signal: AbortSignal.timeout(2800),
      headers: {'User-Agent': 'Veloxis-Telemetry/1.0'},
    });
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        query?: string;
        country?: string;
        countryCode?: string;
        regionName?: string;
        city?: string;
        currency?: string;
        isp?: string;
        org?: string;
        as?: string;
      };
      if (data.status === 'success') {
        const asnMatch = data.as?.match(/AS\d+/i);
        return {
          ip: data.query || cleanIp,
          isp: data.isp || data.org || 'Unknown ISP',
          asn: asnMatch ? asnMatch[0].toUpperCase() : '',
          city: data.city || '',
          region: data.regionName || '',
          country: data.country || '',
          countryCode: data.countryCode || '',
          currencyCode: data.currency || '',
          serverNode: 'Veloxis Edge · Cloud Run',
          detected: true,
        };
      }
    }
  } catch {
    // Try secondary geo-IP source below
  }

  const ipWhoEndpoint = isPrivateIp(cleanIp)
    ? 'https://ipwho.is/'
    : `https://ipwho.is/${encodeURIComponent(cleanIp)}`;

  try {
    const res = await fetch(ipWhoEndpoint, {
      signal: AbortSignal.timeout(2500),
      headers: {'User-Agent': 'Veloxis-Telemetry/1.0'},
    });
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        ip?: string;
        city?: string;
        region?: string;
        country?: string;
        country_code?: string;
        currency?: {code?: string};
        connection?: {isp?: string; org?: string; asn?: number};
      };
      if (data.success !== false) {
        return {
          ip: data.ip || cleanIp,
          isp: data.connection?.isp || data.connection?.org || 'Unknown ISP',
          asn: data.connection?.asn ? `AS${data.connection.asn}` : '',
          city: data.city || '',
          region: data.region || '',
          country: data.country || '',
          countryCode: data.country_code || '',
          currencyCode: data.currency?.code || '',
          serverNode: 'Veloxis Edge · Cloud Run',
          detected: true,
        };
      }
    }
  } catch {
    // No external geo-IP reachable
  }

  return {
    ip: cleanIp,
    isp: '',
    asn: '',
    city: '',
    region: '',
    country: '',
    countryCode: '',
    currencyCode: '',
    serverNode: 'Veloxis Edge · Local Node',
    detected: false,
  };
}

function buildExtensionFiles(baseUrl: string): Record<string, string | Buffer> {
  const manifest = {
    manifest_version: 3,
    name: 'Veloxis Speed Test',
    version: '1.0.0',
    description:
      'Instant internet speed test, latency check, and connection score right from your Chrome toolbar.',
    permissions: ['storage'],
    host_permissions: [`${baseUrl}/*`],
    action: {
      default_popup: 'popup.html',
      default_title: 'Veloxis Speed Test',
      default_icon: {
        '16': 'icons/icon128.png',
        '48': 'icons/icon128.png',
        '128': 'icons/icon128.png',
      },
    },
    icons: {
      '16': 'icons/icon128.png',
      '48': 'icons/icon128.png',
      '128': 'icons/icon128.png',
    },
  };

  const popupHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Veloxis Speed Test</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">Veloxis</div>
    <span class="isp" id="ispLabel">Detecting ISP...</span>
  </header>
  <main class="stage">
    <div class="primary-metric">
      <div class="label" id="phaseLabel">Ready to test</div>
      <div class="value-row">
        <span class="value" id="mainSpeed">0.0</span>
        <span class="unit">Mbps</span>
      </div>
    </div>
    <div class="grid">
      <div class="cell">
        <span class="cell-label">Download</span>
        <span class="cell-val" id="dlVal">-- Mbps</span>
      </div>
      <div class="cell">
        <span class="cell-label">Upload</span>
        <span class="cell-val" id="ulVal">-- Mbps</span>
      </div>
      <div class="cell">
        <span class="cell-label">Ping</span>
        <span class="cell-val" id="pingVal">-- ms</span>
      </div>
      <div class="cell">
        <span class="cell-label">Score</span>
        <span class="cell-val" id="scoreVal">-- / 100</span>
      </div>
    </div>
    <div class="actions">
      <button id="runBtn" class="btn-primary">Start Speed Test</button>
      <a href="${baseUrl}" target="_blank" rel="noreferrer" class="btn-secondary">Full Telemetry</a>
    </div>
  </main>
  <footer class="sponsor">
    <span>Sponsored · Zero-disruption ad slot</span>
  </footer>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupCss = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #F8FAFC;
  color: #0F172A;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
}
.brand { font-weight: 700; font-size: 15px; letter-spacing: -0.02em; }
.isp { font-size: 11px; color: #64748B; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage { padding: 16px; }
.primary-metric {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  margin-bottom: 12px;
}
.label { font-size: 12px; color: #64748B; margin-bottom: 4px; }
.value-row { display: flex; justify-content: center; align-items: baseline; gap: 6px; }
.value { font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; color: #0F172A; }
.unit { font-size: 13px; color: #64748B; font-weight: 600; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.cell {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cell-label { font-size: 11px; color: #64748B; }
.cell-val { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.actions { display: flex; gap: 8px; }
.btn-primary {
  flex: 1;
  background: #2563EB;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover { background: #1D4ED8; }
.btn-primary:disabled { opacity: 0.65; cursor: wait; }
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  color: #0F172A;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.sponsor {
  padding: 8px 16px;
  border-top: 1px solid #E2E8F0;
  background: #FFFFFF;
  font-size: 11px;
  color: #64748B;
  text-align: center;
}`;

  const popupJs = `const BASE_URL = ${JSON.stringify(baseUrl)};
const runBtn = document.getElementById('runBtn');
const phaseLabel = document.getElementById('phaseLabel');
const mainSpeed = document.getElementById('mainSpeed');
const dlVal = document.getElementById('dlVal');
const ulVal = document.getElementById('ulVal');
const pingVal = document.getElementById('pingVal');
const scoreVal = document.getElementById('scoreVal');
const ispLabel = document.getElementById('ispLabel');

fetch(BASE_URL + '/api/network-info')
  .then(r => r.json())
  .then(info => { ispLabel.textContent = info.isp || 'Connected'; })
  .catch(() => { ispLabel.textContent = 'Veloxis Edge'; });

async function measurePing() {
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const t0 = performance.now();
    await fetch(BASE_URL + '/api/speedtest/ping?t=' + Date.now() + '_' + i, { cache: 'no-store' });
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

async function measureDownload() {
  const bytes = 4 * 1024 * 1024;
  const t0 = performance.now();
  const res = await fetch(BASE_URL + '/api/speedtest/download?bytes=' + bytes + '&t=' + Date.now(), { cache: 'no-store' });
  const buf = await res.arrayBuffer();
  const sec = Math.max(0.05, (performance.now() - t0) / 1000);
  return (buf.byteLength * 8) / (sec * 1e6);
}

async function measureUpload() {
  const payload = new Uint8Array(2 * 1024 * 1024);
  const t0 = performance.now();
  await fetch(BASE_URL + '/api/speedtest/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload
  });
  const sec = Math.max(0.05, (performance.now() - t0) / 1000);
  return (payload.byteLength * 8) / (sec * 1e6);
}

runBtn.addEventListener('click', async () => {
  runBtn.disabled = true;
  try {
    phaseLabel.textContent = 'Measuring latency...';
    const ping = await measurePing();
    pingVal.textContent = Math.round(ping) + ' ms';

    phaseLabel.textContent = 'Measuring download...';
    const dl = await measureDownload();
    mainSpeed.textContent = dl.toFixed(1);
    dlVal.textContent = dl.toFixed(1) + ' Mbps';

    phaseLabel.textContent = 'Measuring upload...';
    const ul = await measureUpload();
    ulVal.textContent = ul.toFixed(1) + ' Mbps';

    const score = Math.min(100, Math.round(Math.min(50, dl / 4) + Math.min(25, ul / 2) + Math.max(0, 25 - ping / 4)));
    scoreVal.textContent = score + ' / 100';
    phaseLabel.textContent = 'Test complete';
  } catch (err) {
    phaseLabel.textContent = 'Unable to reach Veloxis node';
  } finally {
    runBtn.disabled = false;
  }
});`;

  const readme = `VELOXIS CHROME EXTENSION (MANIFEST V3)
========================================
1. Unzip this archive into a permanent folder (e.g. Documents/veloxis-extension).
2. Open Google Chrome and navigate to: chrome://extensions
3. Toggle "Developer mode" ON in the top-right corner.
4. Click "Load unpacked" and select the unzipped folder.
5. Pin the Veloxis icon to your Chrome toolbar for instant 1-click speed tests!
`;

  const iconPath = path.resolve(__dirname, 'public', 'pwa-192x192.png');
  const iconBuffer = fs.existsSync(iconPath) ? fs.readFileSync(iconPath) : Buffer.alloc(0);

  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'popup.html': popupHtml,
    'popup.css': popupCss,
    'popup.js': popupJs,
    'README.txt': readme,
    'icons/icon128.png': iconBuffer,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

  // Prevent caching on all telemetry endpoints
  app.use('/api/speedtest', (_req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  interface EdgeNodeDef {
    id: string;
    label: string;
    region: string;
    probeUrl: string | null;
    isPrimary?: boolean;
  }

  const EDGE_NODES: EdgeNodeDef[] = [
    {
      id: 'local',
      label: 'Veloxis Edge · Local Node',
      region: 'Primary Host',
      probeUrl: null,
      isPrimary: true,
    },
    {
      id: 'asia-east',
      label: 'Tokyo Edge (AP-Northeast)',
      region: 'Asia-East',
      probeUrl: 'https://s3.ap-northeast-1.amazonaws.com/ping',
    },
    {
      id: 'asia-south',
      label: 'Singapore Edge (AP-Southeast)',
      region: 'Asia-South',
      probeUrl: 'https://s3.ap-southeast-1.amazonaws.com/ping',
    },
    {
      id: 'us-west',
      label: 'Oregon Edge (US-West)',
      region: 'North America',
      probeUrl: 'https://s3.us-west-2.amazonaws.com/ping',
    },
    {
      id: 'eu-central',
      label: 'Frankfurt Edge (EU-Central)',
      region: 'Europe',
      probeUrl: 'https://s3.eu-central-1.amazonaws.com/ping',
    },
  ];

  async function probeEdgeUrl(url: string): Promise<number | null> {
    const start = process.hrtime.bigint();
    try {
      await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2200),
      });
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      return Math.max(1, Number(ms.toFixed(1)));
    } catch {
      return null;
    }
  }

  app.get('/api/edge-nodes', async (_req, res) => {
    const results = await Promise.all(
      EDGE_NODES.map(async (node) => {
        if (!node.probeUrl) {
          return {
            id: node.id,
            label: node.label,
            region: node.region,
            rttMs: 1,
            available: true,
            isPrimary: true,
          };
        }
        const hopMs = await probeEdgeUrl(node.probeUrl);
        return {
          id: node.id,
          label: node.label,
          region: node.region,
          rttMs: hopMs,
          available: hopMs !== null,
          isPrimary: false,
        };
      }),
    );
    res.json({nodes: results});
  });

  app.get('/api/dns-benchmark/system', async (_req, res) => {
    const start = process.hrtime.bigint();
    try {
      await dns.promises.lookup('example.com', {all: false});
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      res.json({
        ok: true,
        resolver: 'System / ISP Resolver',
        latencyMs: Math.max(1, Number(ms.toFixed(1))),
      });
    } catch {
      res.json({
        ok: false,
        resolver: 'System / ISP Resolver',
        latencyMs: null,
      });
    }
  });

  app.get('/api/speedtest/ping', async (req, res) => {
    const nodeId = typeof req.query.node === 'string' ? req.query.node : 'local';
    const nodeDef = EDGE_NODES.find((n) => n.id === nodeId);
    let edgeHopMs = 0;
    if (nodeDef?.probeUrl) {
      const measured = await probeEdgeUrl(nodeDef.probeUrl);
      if (measured !== null) {
        edgeHopMs = measured;
      }
    }
    res.json({
      ok: true,
      node: nodeDef?.id ?? 'local',
      edgeHopMs,
      serverTime: Date.now(),
    });
  });

  app.get('/api/speedtest/download', (req, res) => {
    const requested = Number(req.query.bytes) || 4 * 1024 * 1024;
    const totalBytes = Math.max(65536, Math.min(25 * 1024 * 1024, requested));

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(totalBytes));
    res.setHeader('X-Veloxis-Bytes', String(totalBytes));

    let sent = 0;
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    function writeNext() {
      while (!aborted && sent < totalBytes) {
        const remaining = totalBytes - sent;
        const slice =
          remaining >= CHUNK_SIZE ? RANDOM_CHUNK : RANDOM_CHUNK.subarray(0, remaining);
        sent += slice.length;
        const canContinue = res.write(slice);
        if (!canContinue) {
          res.once('drain', writeNext);
          return;
        }
      }
      if (!aborted && sent >= totalBytes) {
        res.end();
      }
    }

    writeNext();
  });

  app.post('/api/speedtest/upload', (req, res) => {
    const startNs = process.hrtime.bigint();
    let receivedBytes = 0;
    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

    req.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_UPLOAD_BYTES) {
        req.destroy();
      }
    });

    req.on('end', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
      res.json({
        receivedBytes,
        serverDurationMs: Math.max(1, Number(elapsedMs.toFixed(2))),
      });
    });

    req.on('error', () => {
      if (!res.headersSent) {
        res.status(400).json({error: 'Upload stream interrupted'});
      }
    });
  });

  app.get('/api/network-info', async (req, res) => {
    const clientIp = getClientIp(req);
    const info = await lookupNetworkInfo(clientIp);
    res.json(info);
  });

  app.get('/api/regional-isps', async (req, res) => {
    const rawCode = typeof req.query.countryCode === 'string' ? req.query.countryCode.trim().toUpperCase() : '';
    const cityHint = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';

    if (!/^[A-Z]{2}$/.test(rawCode)) {
      res.json({
        countryCode: '',
        operators: [],
        available: false,
        note: 'Country could not be determined automatically.',
      });
      return;
    }

    try {
      const pdbRes = await fetch(
        `https://www.peeringdb.com/api/org?country=${encodeURIComponent(rawCode)}&limit=18`,
        {
          signal: AbortSignal.timeout(3500),
          headers: {'User-Agent': 'Veloxis-Telemetry/1.0'},
        },
      );

      if (!pdbRes.ok) {
        res.json({
          countryCode: rawCode,
          operators: [],
          available: false,
          note: 'Regional ISP registry did not respond.',
        });
        return;
      }

      const payload = (await pdbRes.json()) as {
        data?: Array<{
          id?: number;
          name?: string;
          city?: string;
          state?: string;
          website?: string;
        }>;
      };

      const rawOps = (payload.data || [])
        .filter((o) => o.name && o.name.trim().length > 0)
        .map((o) => ({
          id: o.id ?? 0,
          name: (o.name || '').trim(),
          city: (o.city || '').trim(),
          state: (o.state || '').trim(),
          website: (o.website || '').trim(),
        }));

      rawOps.sort((a, b) => {
        const aCity = cityHint && a.city.toLowerCase() === cityHint ? 1 : 0;
        const bCity = cityHint && b.city.toLowerCase() === cityHint ? 1 : 0;
        if (aCity !== bCity) return bCity - aCity;
        const aWeb = a.website ? 1 : 0;
        const bWeb = b.website ? 1 : 0;
        return bWeb - aWeb;
      });

      res.json({
        countryCode: rawCode,
        operators: rawOps.slice(0, 8),
        available: rawOps.length > 0,
        source: 'PeeringDB',
      });
    } catch {
      res.json({
        countryCode: rawCode,
        operators: [],
        available: false,
        note: 'Unable to query regional ISP directory.',
      });
    }
  });

  interface ServerDeviceSession {
    deviceId: string;
    ip: string;
    label: string;
    os: string;
    browser: string;
    deviceType: string;
    linkType: string;
    rttMs: number;
    bytesDown: number;
    bytesUp: number;
    downloadMbps: number;
    uploadMbps: number;
    lastSeenAt: number;
  }

  const deviceRegistry = new Map<string, ServerDeviceSession>();
  const DEVICE_TTL_MS = 15 * 60 * 1000;

  function pruneStaleDevices(now: number) {
    for (const [key, entry] of deviceRegistry.entries()) {
      if (now - entry.lastSeenAt > DEVICE_TTL_MS) {
        deviceRegistry.delete(key);
      }
    }
  }

  app.post('/api/devices/heartbeat', express.json({limit: '32kb'}), (req, res) => {
    const now = Date.now();
    pruneStaleDevices(now);
    const cleanIp = getClientIp(req).replace(/^::ffff:/, '');
    const body = (req.body || {}) as Partial<ServerDeviceSession>;
    const deviceId =
      typeof body.deviceId === 'string' && body.deviceId.trim().length > 0
        ? body.deviceId.trim().slice(0, 64)
        : `dev_${crypto.createHash('sha1').update(`${cleanIp}_${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 10)}`;

    const sessionKey = `${cleanIp}::${deviceId}`;
    const existing = deviceRegistry.get(sessionKey);

    const record: ServerDeviceSession = {
      deviceId,
      ip: cleanIp,
      label: typeof body.label === 'string' ? body.label.slice(0, 80) : 'Connected Device',
      os: typeof body.os === 'string' ? body.os.slice(0, 40) : 'Unknown OS',
      browser: typeof body.browser === 'string' ? body.browser.slice(0, 40) : 'Browser',
      deviceType: typeof body.deviceType === 'string' ? body.deviceType.slice(0, 24) : 'Desktop',
      linkType: typeof body.linkType === 'string' ? body.linkType.slice(0, 32) : 'Broadband',
      rttMs: Number.isFinite(Number(body.rttMs)) ? Math.max(0, Number(body.rttMs)) : 0,
      bytesDown: Math.max(existing?.bytesDown ?? 0, Number(body.bytesDown) || 0),
      bytesUp: Math.max(existing?.bytesUp ?? 0, Number(body.bytesUp) || 0),
      downloadMbps: Number.isFinite(Number(body.downloadMbps)) ? Math.max(0, Number(body.downloadMbps)) : existing?.downloadMbps ?? 0,
      uploadMbps: Number.isFinite(Number(body.uploadMbps)) ? Math.max(0, Number(body.uploadMbps)) : existing?.uploadMbps ?? 0,
      lastSeenAt: now,
    };

    deviceRegistry.set(sessionKey, record);

    const peers = Array.from(deviceRegistry.values()).filter((d) => d.ip === cleanIp);
    res.json({devices: peers});
  });

  app.get('/api/devices', (req, res) => {
    const now = Date.now();
    pruneStaleDevices(now);
    const cleanIp = getClientIp(req).replace(/^::ffff:/, '');
    const peers = Array.from(deviceRegistry.values()).filter((d) => d.ip === cleanIp);
    res.json({devices: peers});
  });

  app.get('/api/extension/download', async (req, res) => {
    try {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
      const baseUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${proto}://${host}`;

      const zip = new JSZip();
      const files = buildExtensionFiles(baseUrl);
      for (const [filePath, content] of Object.entries(files)) {
        zip.file(filePath, content);
      }
      const archive = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="veloxis-chrome-extension.zip"');
      res.setHeader('Content-Length', String(archive.length));
      res.send(archive);
    } catch {
      res.status(500).json({error: 'Failed to generate extension archive'});
    }
  });

  app.get('/ads.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8');
    res.send('google.com, pub-1138327552755079, DIRECT, f08c47fec0942fa0\n');
  });

  const httpServer = http.createServer(app);
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'veloxis-disable-vite-client-ws',
              enforce: 'post',
              transform(code, id) {
                if (id.replace(/\\/g, '/').endsWith('vite/dist/client/client.mjs')) {
                  return code
                    .replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* HMR WebSocket disabled via DISABLE_HMR */',
                    )
                    .replace(
                      'setupForwardConsoleHandler(transport, forwardConsole);',
                      '/* forwardConsole disabled via DISABLE_HMR */',
                    );
                }
                return null;
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: hmrDisabled ? false : {server: httpServer},
        ws: hmrDisabled ? false : {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Veloxis telemetry server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
