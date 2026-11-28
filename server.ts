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
    lat?: number;
    lon?: number;
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
      lat: 35.6762,
      lon: 139.6503,
    },
    {
      id: 'asia-south',
      label: 'Singapore Edge (AP-Southeast)',
      region: 'Asia-South',
      probeUrl: 'https://s3.ap-southeast-1.amazonaws.com/ping',
      lat: 1.3521,
      lon: 103.8198,
    },
    {
      id: 'us-west',
      label: 'Oregon Edge (US-West)',
      region: 'North America',
      probeUrl: 'https://s3.us-west-2.amazonaws.com/ping',
      lat: 45.8399,
      lon: -119.7006,
    },
    {
      id: 'eu-central',
      label: 'Frankfurt Edge (EU-Central)',
      region: 'Europe',
      probeUrl: 'https://s3.eu-central-1.amazonaws.com/ping',
      lat: 50.1109,
      lon: 8.6821,
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
          lat: node.lat,
          lon: node.lon,
        };
      }),
    );
    res.json({nodes: results});
  });

  app.get('/api/dns-benchmark/system', async (_req, res) => {
    const domains = ['example.com', 'iana.org', 'cloudflare.com'];
    const servers = dns.getServers();
    const configuredIp = servers.length > 0 ? servers[0] : 'ISP / System';
    const timings: number[] = [];

    for (const domain of domains) {
      const resolver = new dns.promises.Resolver();
      const start = process.hrtime.bigint();
      try {
        await resolver.resolve4(domain);
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        timings.push(Math.max(1, Number(ms.toFixed(1))));
      } catch {
        // Fallback to OS lookup if custom Resolver fails in restricted sandbox
        try {
          const fallbackStart = process.hrtime.bigint();
          await dns.promises.lookup(domain, {all: false});
          const ms = Number(process.hrtime.bigint() - fallbackStart) / 1e6;
          timings.push(Math.max(1, Number(ms.toFixed(1))));
        } catch {
          // Ignore individual failed domain probe
        }
      }
    }

    if (timings.length === 0) {
      res.json({
        ok: false,
        resolver: 'ISP / System Default',
        ip: configuredIp,
        latencyMs: null,
        minMs: null,
        maxMs: null,
        sampleCount: 0,
      });
      return;
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianMs =
      sorted.length % 2 === 0
        ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
        : sorted[mid];

    res.json({
      ok: true,
      resolver: 'ISP / System Default',
      ip: configuredIp,
      latencyMs: medianMs,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      sampleCount: sorted.length,
    });
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

  type TopologyCategory = 'router' | 'mobile' | 'laptop' | 'landline' | 'tv' | 'other';
  interface StoredRouterNode {
    id: string;
    role: 'primary' | 'secondary';
    mode:
      | 'Primary Gateway'
      | 'Router Mode (Double-NAT)'
      | 'Access Point (AP) Mode'
      | 'Bridge Mode'
      | 'Mesh Node'
      | 'Unknown';
    ip: string;
    mac?: string;
    vendor?: string;
    hostname?: string;
    hopIndex: number;
    latencyMs?: number | null;
    subnet?: string;
  }
  interface StoredTopologyDevice {
    id: string;
    category: TopologyCategory;
    label: string;
    ip?: string;
    mac?: string;
    vendor?: string;
    routerRole?: 'primary' | 'secondary' | 'unknown';
    source: 'lan-probe';
    lastSeenAt: number;
  }
  interface StoredTopologyEntry {
    token: string;
    ip: string;
    routers: StoredRouterNode[];
    devices: StoredTopologyDevice[];
    scannedAt: number;
  }

  const topologyRegistry = new Map<string, StoredTopologyEntry>();
  const TOPOLOGY_TTL_MS = 30 * 60 * 1000;
  const ALLOWED_ROUTER_MODES = new Set([
    'Primary Gateway',
    'Router Mode (Double-NAT)',
    'Access Point (AP) Mode',
    'Bridge Mode',
    'Mesh Node',
    'Unknown',
  ]);
  const ALLOWED_CATEGORIES = new Set<TopologyCategory>([
    'router',
    'mobile',
    'laptop',
    'landline',
    'tv',
    'other',
  ]);

  function pruneStaleTopologies(now: number) {
    for (const [k, entry] of topologyRegistry.entries()) {
      if (now - entry.scannedAt > TOPOLOGY_TTL_MS) {
        topologyRegistry.delete(k);
      }
    }
  }

  function sanitizeToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed) ? trimmed : '';
  }

  function mapSessionDeviceCategory(deviceType: string): TopologyCategory {
    const lower = deviceType.toLowerCase();
    if (lower === 'mobile' || lower === 'tablet') return 'mobile';
    if (lower === 'tv') return 'tv';
    return 'laptop';
  }

  app.post('/api/topology/ingest', express.json({limit: '256kb'}), (req, res) => {
    const now = Date.now();
    pruneStaleTopologies(now);
    const cleanIp = getClientIp(req).replace(/^::ffff:/, '');
    const body = (req.body || {}) as {
      token?: unknown;
      routers?: unknown[];
      devices?: unknown[];
      scannedAt?: unknown;
    };
    const token = sanitizeToken(body.token);
    if (!token) {
      res.status(400).json({error: 'Valid topology token is required'});
      return;
    }

    const rawRouters = Array.isArray(body.routers) ? body.routers.slice(0, 12) : [];
    const routers: StoredRouterNode[] = rawRouters
      .map((r, idx): StoredRouterNode | null => {
        const item = (r || {}) as Record<string, unknown>;
        const ip = typeof item.ip === 'string' ? item.ip.trim().slice(0, 48) : '';
        if (!ip) return null;
        const role: 'primary' | 'secondary' =
          item.role === 'secondary' ? 'secondary' : 'primary';
        const modeRaw = typeof item.mode === 'string' ? item.mode.trim() : 'Unknown';
        const mode = (
          ALLOWED_ROUTER_MODES.has(modeRaw) ? modeRaw : 'Unknown'
        ) as StoredRouterNode['mode'];
        return {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim().slice(0, 64)
              : `router_${idx}_${ip}`,
          role,
          mode,
          ip,
          mac: typeof item.mac === 'string' ? item.mac.trim().slice(0, 32) : undefined,
          vendor: typeof item.vendor === 'string' ? item.vendor.trim().slice(0, 64) : undefined,
          hostname:
            typeof item.hostname === 'string' ? item.hostname.trim().slice(0, 80) : undefined,
          hopIndex: Number.isFinite(Number(item.hopIndex))
            ? Math.max(1, Math.min(30, Number(item.hopIndex)))
            : idx + 1,
          latencyMs:
            item.latencyMs !== null && Number.isFinite(Number(item.latencyMs))
              ? Number(Number(item.latencyMs).toFixed(1))
              : null,
          subnet: typeof item.subnet === 'string' ? item.subnet.trim().slice(0, 32) : undefined,
        };
      })
      .filter((x): x is StoredRouterNode => x !== null);

    const rawDevices = Array.isArray(body.devices) ? body.devices.slice(0, 256) : [];
    const devices: StoredTopologyDevice[] = rawDevices
      .map((d, idx) => {
        const item = (d || {}) as Record<string, unknown>;
        const label =
          typeof item.label === 'string' && item.label.trim()
            ? item.label.trim().slice(0, 80)
            : 'Network Device';
        const catRaw = typeof item.category === 'string' ? item.category.trim().toLowerCase() : 'other';
        const category = (
          ALLOWED_CATEGORIES.has(catRaw as TopologyCategory) ? catRaw : 'other'
        ) as TopologyCategory;
        const routerRole =
          item.routerRole === 'primary' || item.routerRole === 'secondary'
            ? item.routerRole
            : 'unknown';
        return {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim().slice(0, 64)
              : `lan_${idx}_${Date.now()}`,
          category,
          label,
          ip: typeof item.ip === 'string' ? item.ip.trim().slice(0, 48) : undefined,
          mac: typeof item.mac === 'string' ? item.mac.trim().slice(0, 32) : undefined,
          vendor: typeof item.vendor === 'string' ? item.vendor.trim().slice(0, 64) : undefined,
          routerRole,
          source: 'lan-probe' as const,
          lastSeenAt: now,
        };
      });

    const entry: StoredTopologyEntry = {
      token,
      ip: cleanIp,
      routers,
      devices,
      scannedAt: now,
    };
    topologyRegistry.set(token, entry);
    res.json({
      ok: true,
      routersCount: routers.length,
      devicesCount: devices.length,
      scannedAt: now,
    });
  });

  app.get('/api/topology', async (req, res) => {
    const now = Date.now();
    pruneStaleDevices(now);
    pruneStaleTopologies(now);

    const cleanIp = getClientIp(req).replace(/^::ffff:/, '');
    const token = sanitizeToken(req.query.token);
    const currentDeviceId =
      typeof req.query.deviceId === 'string' ? req.query.deviceId.trim().slice(0, 64) : '';

    let matchedEntry: StoredTopologyEntry | undefined = token
      ? topologyRegistry.get(token)
      : undefined;

    if (!matchedEntry) {
      for (const candidate of topologyRegistry.values()) {
        if (candidate.ip === cleanIp) {
          if (!matchedEntry || candidate.scannedAt > matchedEntry.scannedAt) {
            matchedEntry = candidate;
          }
        }
      }
    }

    const sessionPeers = Array.from(deviceRegistry.values()).filter(
      (d) => d.ip === cleanIp,
    );

    const mergedDevices: Array<{
      id: string;
      category: TopologyCategory;
      label: string;
      ip?: string;
      mac?: string;
      vendor?: string;
      routerRole?: 'primary' | 'secondary' | 'unknown';
      source: 'lan-probe' | 'veloxis-session';
      isCurrentDevice?: boolean;
      rttMs?: number | null;
      lastSeenAt: number;
    }> = [];

    if (matchedEntry) {
      for (const dev of matchedEntry.devices) {
        mergedDevices.push(dev);
      }
    }

    for (const peer of sessionPeers) {
      const alreadyListed = mergedDevices.some(
        (d) => d.isCurrentDevice && peer.deviceId === currentDeviceId,
      );
      if (!alreadyListed) {
        mergedDevices.push({
          id: `session_${peer.deviceId}`,
          category: mapSessionDeviceCategory(peer.deviceType),
          label: peer.label,
          routerRole: matchedEntry?.routers.some((r) => r.role === 'secondary')
            ? 'secondary'
            : matchedEntry?.routers.length
              ? 'primary'
              : 'unknown',
          source: 'veloxis-session',
          isCurrentDevice: peer.deviceId === currentDeviceId,
          rttMs: peer.rttMs || null,
          lastSeenAt: peer.lastSeenAt,
        });
      }
    }

    const categoryCounts: Record<TopologyCategory, number> & {total: number} = {
      router: 0,
      mobile: 0,
      laptop: 0,
      landline: 0,
      tv: 0,
      other: 0,
      total: 0,
    };

    for (const dev of mergedDevices) {
      categoryCounts[dev.category] += 1;
      categoryCounts.total += 1;
    }

    const netInfo = await lookupNetworkInfo(cleanIp);

    res.json({
      token: token || matchedEntry?.token || '',
      publicIp: netInfo.ip || cleanIp,
      isp: netInfo.isp,
      asn: netInfo.asn,
      probeConnected: Boolean(matchedEntry),
      lastScannedAt: matchedEntry?.scannedAt ?? null,
      source: matchedEntry ? 'lan-probe' : 'veloxis-sessions',
      routers: matchedEntry?.routers ?? [],
      devices: mergedDevices,
      categoryCounts,
      notes: matchedEntry
        ? 'Topology includes real LAN hop & ARP neighbor scan plus active Veloxis sessions.'
        : 'Showing active Veloxis devices on this ISP connection. Run the local LAN probe to discover primary/secondary routers and non-browser devices (TVs, phones, landline VoIP).',
    });
  });

  app.get('/api/lan-agent/script', (req, res) => {
    const token = sanitizeToken(req.query.token) || 'veloxis_local_probe';
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host =
      req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${proto}://${host}`;

    const script = `#!/usr/bin/env node
// Veloxis Local Network Topology & Router Probe (Pure Node.js, zero dependencies)
import { exec } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const BASE_URL = ${JSON.stringify(baseUrl)};
const TOKEN = ${JSON.stringify(token)};
const ONCE = process.argv.includes('--once');

const OUI_VENDORS = {
  // Networking / Routers / APs
  '00:18:e7': { vendor: 'Cameo / D-Link', cat: 'router' },
  '00:24:01': { vendor: 'D-Link', cat: 'router' },
  '14:cc:20': { vendor: 'TP-Link', cat: 'router' },
  '50:c7:bf': { vendor: 'TP-Link', cat: 'router' },
  '98:da:c4': { vendor: 'TP-Link', cat: 'router' },
  'b0:be:76': { vendor: 'TP-Link', cat: 'router' },
  'c0:06:c3': { vendor: 'TP-Link', cat: 'router' },
  'e8:94:f6': { vendor: 'TP-Link', cat: 'router' },
  '18:e8:29': { vendor: 'Ubiquiti UniFi', cat: 'router' },
  '24:5a:4c': { vendor: 'Ubiquiti', cat: 'router' },
  '74:83:c2': { vendor: 'Ubiquiti', cat: 'router' },
  'fc:ec:da': { vendor: 'Ubiquiti', cat: 'router' },
  '04:d4:c4': { vendor: 'ASUS Router', cat: 'router' },
  '2c:fd:a1': { vendor: 'ASUS Router', cat: 'router' },
  'ac:9e:17': { vendor: 'ASUS Router', cat: 'router' },
  '28:c6:8e': { vendor: 'NETGEAR', cat: 'router' },
  'a0:04:60': { vendor: 'NETGEAR', cat: 'router' },
  'c4:04:15': { vendor: 'NETGEAR', cat: 'router' },
  '4c:5e:0c': { vendor: 'MikroTik', cat: 'router' },
  'd4:ca:6d': { vendor: 'MikroTik', cat: 'router' },
  '00:1a:2b': { vendor: 'Ayecom / Router', cat: 'router' },
  '68:7f:74': { vendor: 'Linksys', cat: 'router' },
  '34:6b:d3': { vendor: 'Huawei Router', cat: 'router' },
  '48:46:fb': { vendor: 'Huawei', cat: 'router' },
  '00:e0:4c': { vendor: 'Realtek / Gateway', cat: 'other' },
  // Landline / VoIP / SIP Phones
  '00:04:f2': { vendor: 'Polycom VoIP Phone', cat: 'landline' },
  '64:16:7f': { vendor: 'Polycom VoIP', cat: 'landline' },
  '00:15:65': { vendor: 'Yealink SIP Phone', cat: 'landline' },
  '80:5e:c0': { vendor: 'Yealink VoIP', cat: 'landline' },
  '00:0b:82': { vendor: 'Grandstream VoIP', cat: 'landline' },
  'c0:74:ad': { vendor: 'Grandstream SIP', cat: 'landline' },
  '00:08:5d': { vendor: 'Aastra / Mitel VoIP', cat: 'landline' },
  '7c:2f:80': { vendor: 'Gigaset DECT Landline', cat: 'landline' },
  '00:04:13': { vendor: 'Snom VoIP Phone', cat: 'landline' },
  '00:1b:d4': { vendor: 'Cisco IP Phone', cat: 'landline' },
  // Smart TVs / Media
  '00:1e:75': { vendor: 'LG Smart TV', cat: 'tv' },
  '14:c9:13': { vendor: 'LG webOS TV', cat: 'tv' },
  '3c:bd:d8': { vendor: 'LG Electronics TV', cat: 'tv' },
  'cc:2d:83': { vendor: 'LG Electronics', cat: 'tv' },
  '00:12:fb': { vendor: 'Samsung Smart TV', cat: 'tv' },
  '50:85:69': { vendor: 'Samsung TV', cat: 'tv' },
  'cc:6e:a4': { vendor: 'Samsung Smart TV', cat: 'tv' },
  'f4:7b:5e': { vendor: 'Samsung Electronics', cat: 'tv' },
  '00:1d:ba': { vendor: 'Sony Bravia TV', cat: 'tv' },
  'ac:9b:0a': { vendor: 'Sony TV', cat: 'tv' },
  'b0:ee:7b': { vendor: 'Roku TV / Stick', cat: 'tv' },
  'dc:3a:5e': { vendor: 'Roku Streaming', cat: 'tv' },
  '68:54:fd': { vendor: 'Amazon Fire TV', cat: 'tv' },
  'f0:27:2d': { vendor: 'Amazon Fire TV', cat: 'tv' },
  // Mobile Phones
  '00:cd:fe': { vendor: 'Apple iPhone/iPad', cat: 'mobile' },
  '28:cf:e9': { vendor: 'Apple', cat: 'mobile' },
  'f0:18:98': { vendor: 'Apple', cat: 'mobile' },
  '38:ca:da': { vendor: 'Apple iPhone', cat: 'mobile' },
  '50:32:75': { vendor: 'Apple', cat: 'mobile' },
  '34:2d:0d': { vendor: 'Samsung Galaxy', cat: 'mobile' },
  '84:25:db': { vendor: 'Samsung Mobile', cat: 'mobile' },
  'c4:9a:02': { vendor: 'Xiaomi Mobile', cat: 'mobile' },
  '64:cc:2e': { vendor: 'Xiaomi', cat: 'mobile' },
  '98:fa:e3': { vendor: 'Xiaomi', cat: 'mobile' },
  'f8:a4:5f': { vendor: 'Xiaomi', cat: 'mobile' },
  'c0:ee:fb': { vendor: 'OnePlus', cat: 'mobile' },
  '94:65:2d': { vendor: 'OnePlus', cat: 'mobile' },
  'd8:eb:97': { vendor: 'Google Pixel', cat: 'mobile' },
  '3c:5a:b4': { vendor: 'Google', cat: 'mobile' },
  // Laptops / PCs
  '3c:22:fb': { vendor: 'Apple MacBook', cat: 'laptop' },
  'ac:de:48': { vendor: 'Apple Mac', cat: 'laptop' },
  'a4:83:e7': { vendor: 'Apple MacBook', cat: 'laptop' },
  'd4:be:d9': { vendor: 'Dell Laptop', cat: 'laptop' },
  'f8:b1:56': { vendor: 'Dell', cat: 'laptop' },
  '00:21:6a': { vendor: 'Intel Wi-Fi Laptop', cat: 'laptop' },
  '8c:8d:28': { vendor: 'Intel Wireless', cat: 'laptop' },
  '54:e1:ad': { vendor: 'Lenovo ThinkPad', cat: 'laptop' },
  '98:fa:9b': { vendor: 'Lenovo', cat: 'laptop' },
  'dc:4a:3e': { vendor: 'HP Laptop', cat: 'laptop' },
  'b4:b5:2f': { vendor: 'Hewlett Packard', cat: 'laptop' },
};

function normalizeMac(mac) {
  if (!mac) return '';
  const parts = mac.toLowerCase().replace(/-/g, ':').split(':').filter(Boolean);
  if (parts.length !== 6) return '';
  return parts.map((p) => p.padStart(2, '0')).join(':');
}

function isPrivateIp(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\\.(1[6-9]|2\\d|3[0-1])\\./.test(ip)
  );
}

function isCgnatIp(ip) {
  return /^100\\.(6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])\\./.test(ip);
}

function classifyHost({ ip, mac, hostname, isGateway }) {
  const normMac = normalizeMac(mac);
  const oui = normMac ? normMac.slice(0, 8) : '';
  const ouiInfo = OUI_VENDORS[oui];
  const h = (hostname || '').toLowerCase();

  if (isGateway) {
    return { category: 'router', vendor: ouiInfo?.vendor || 'Network Gateway' };
  }
  if (/iphone|android|galaxy|pixel|redmi|xiaomi|oneplus|oppo|vivo|realme|phone/.test(h) && !/sip|voip|polycom|yealink|cisco/.test(h)) {
    return { category: 'mobile', vendor: ouiInfo?.vendor || 'Mobile Device' };
  }
  if (/bravia|webos|tizen|roku|chromecast|firetv|appletv|smarttv|tv/.test(h)) {
    return { category: 'tv', vendor: ouiInfo?.vendor || 'Smart TV' };
  }
  if (/yealink|polycom|grandstream|cisco-spa|snom|gigaset|voip|sip|ata/.test(h)) {
    return { category: 'landline', vendor: ouiInfo?.vendor || 'Landline / VoIP Phone' };
  }
  if (/macbook|imac|thinkpad|laptop|desktop|pc|ubuntu|fedora|windows/.test(h)) {
    return { category: 'laptop', vendor: ouiInfo?.vendor || 'Computer' };
  }
  if (/router|gateway|ap-|unifi|tplink|openwrt|mikrotik|asus|netgear|eero|orbi|deco/.test(h)) {
    return { category: 'router', vendor: ouiInfo?.vendor || 'Router / Access Point' };
  }
  if (ouiInfo) {
    return { category: ouiInfo.cat, vendor: ouiInfo.vendor };
  }
  return { category: 'other', vendor: 'Connected LAN Host' };
}

function getLocalIpv4() {
  const ifaces = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    for (const addr of list) {
      if (addr.family === 'IPv4' && !addr.internal && isPrivateIp(addr.address)) {
        return { iface: name, ip: addr.address, mac: normalizeMac(addr.mac) };
      }
    }
  }
  return null;
}

async function getDefaultGateway() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const { stdout } = await execAsync('route -n get default');
      const m = stdout.match(/gateway:\\s*([\\d.]+)/);
      if (m) return m[1];
    } else if (platform === 'win32') {
      const { stdout } = await execAsync('route print 0.0.0.0');
      const m = stdout.match(/0\\.0\\.0\\.0\\s+0\\.0\\.0\\.0\\s+([\\d.]+)/);
      if (m) return m[1];
    } else {
      const { stdout } = await execAsync('ip route show default');
      const m = stdout.match(/default via ([\\d.]+)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

async function traceFirstHops() {
  const platform = os.platform();
  const cmd = platform === 'win32'
    ? 'tracert -d -h 4 -w 700 1.1.1.1'
    : 'traceroute -n -m 4 -w 1 -q 1 1.1.1.1';
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    const hops = [];
    for (const line of stdout.split('\\n')) {
      const hopMatch = line.match(/^\\s*(\\d+)\\s+(.+)$/);
      if (!hopMatch) continue;
      const hopIndex = Number(hopMatch[1]);
      const ipMatch = hopMatch[2].match(/(\\d{1,3}(?:\\.\\d{1,3}){3})/);
      const msMatch = hopMatch[2].match(/([\\d.]+)\\s*ms/);
      if (ipMatch) {
        hops.push({
          hopIndex,
          ip: ipMatch[1],
          latencyMs: msMatch ? Number(msMatch[1]) : null,
        });
      }
    }
    return hops;
  } catch {
    return [];
  }
}

async function pingSweepSubnet(localIp) {
  if (!localIp) return;
  const prefix = localIp.split('.').slice(0, 3).join('.');
  const isWin = os.platform() === 'win32';
  const batchSize = 24;
  for (let start = 1; start <= 254; start += batchSize) {
    const tasks = [];
    for (let i = start; i < Math.min(255, start + batchSize); i++) {
      const target = prefix + '.' + i;
      const cmd = isWin ? 'ping -n 1 -w 220 ' + target : 'ping -c 1 -W 1 ' + target;
      tasks.push(execAsync(cmd, { timeout: 1200 }).catch(() => {}));
    }
    await Promise.all(tasks);
  }
}

async function readArpTable() {
  const entries = [];
  const seen = new Set();
  try {
    const cmd = os.platform() === 'linux' ? 'ip neigh show || arp -a' : 'arp -a';
    const { stdout } = await execAsync(cmd, { timeout: 4000 });
    for (const line of stdout.split('\\n')) {
      const ipMatch = line.match(/(\\d{1,3}(?:\\.\\d{1,3}){3})/);
      const macMatch = line.match(/([0-9a-fA-F]{1,2}[:-]){5}[0-9a-fA-F]{1,2}/);
      if (!ipMatch || !macMatch) continue;
      const ip = ipMatch[1];
      const mac = normalizeMac(macMatch[0]);
      if (!mac || mac === 'ff:ff:ff:ff:ff:ff' || ip.endsWith('.255') || ip.startsWith('224.') || ip.startsWith('239.')) continue;
      if (seen.has(ip)) continue;
      seen.add(ip);
      const hostMatch = line.match(/^([^\\s?(]+)\\s+\\(/);
      const hostname = hostMatch && hostMatch[1] !== '?' ? hostMatch[1] : '';
      entries.push({ ip, mac, hostname });
    }
  } catch {}
  return entries;
}

async function runNetworkScan() {
  const local = getLocalIpv4();
  const gatewayIp = await getDefaultGateway();
  const [hops] = await Promise.all([
    traceFirstHops(),
    pingSweepSubnet(local?.ip),
  ]);
  const arpEntries = await readArpTable();

  const privateHops = hops.filter((h) => isPrivateIp(h.ip));
  const routers = [];
  const hasDoubleNat = privateHops.length >= 2 && privateHops[0].ip !== privateHops[1].ip;

  if (hasDoubleNat) {
    const secHop = privateHops[0];
    const priHop = privateHops[1];
    const secArp = arpEntries.find((a) => a.ip === secHop.ip);
    routers.push({
      id: 'sec_' + secHop.ip,
      role: 'secondary',
      mode: 'Router Mode (Double-NAT)',
      ip: secHop.ip,
      mac: secArp?.mac,
      vendor: secArp ? classifyHost({ ...secArp, isGateway: true }).vendor : 'Secondary Router',
      hostname: secArp?.hostname,
      hopIndex: secHop.hopIndex,
      latencyMs: secHop.latencyMs,
      subnet: secHop.ip.split('.').slice(0, 3).join('.') + '.0/24',
    });
    routers.push({
      id: 'pri_' + priHop.ip,
      role: 'primary',
      mode: 'Primary Gateway',
      ip: priHop.ip,
      hopIndex: priHop.hopIndex,
      latencyMs: priHop.latencyMs,
      subnet: priHop.ip.split('.').slice(0, 3).join('.') + '.0/24',
    });
  } else {
    const priIp = privateHops[0]?.ip || gatewayIp;
    if (priIp) {
      const priArp = arpEntries.find((a) => a.ip === priIp);
      routers.push({
        id: 'pri_' + priIp,
        role: 'primary',
        mode: 'Primary Gateway',
        ip: priIp,
        mac: priArp?.mac,
        vendor: priArp ? classifyHost({ ...priArp, isGateway: true }).vendor : 'Primary Router',
        hostname: priArp?.hostname,
        hopIndex: privateHops[0]?.hopIndex || 1,
        latencyMs: privateHops[0]?.latencyMs ?? null,
        subnet: priIp.split('.').slice(0, 3).join('.') + '.0/24',
      });
    }
    // Check ARP table for additional routers / Access Points running in AP or Bridge mode on the same subnet
    for (const entry of arpEntries) {
      if (entry.ip === priIp) continue;
      const cls = classifyHost({ ...entry, isGateway: false });
      if (cls.category === 'router') {
        routers.push({
          id: 'ap_' + entry.ip,
          role: 'secondary',
          mode: 'Access Point (AP) Mode',
          ip: entry.ip,
          mac: entry.mac,
          vendor: cls.vendor,
          hostname: entry.hostname,
          hopIndex: 1,
          latencyMs: null,
          subnet: entry.ip.split('.').slice(0, 3).join('.') + '.0/24',
        });
      }
    }
  }

  const devices = [];
  if (local) {
    const selfCat = os.platform() === 'android' || os.platform() === 'ios' ? 'mobile' : 'laptop';
    devices.push({
      id: 'self_' + local.ip,
      category: selfCat,
      label: os.hostname() + ' (This Machine)',
      ip: local.ip,
      mac: local.mac,
      vendor: os.type() + ' ' + os.arch(),
      routerRole: hasDoubleNat ? 'secondary' : 'primary',
    });
  }

  for (const entry of arpEntries) {
    if (local && entry.ip === local.ip) continue;
    const isGw = routers.some((r) => r.ip === entry.ip);
    const cls = classifyHost({ ...entry, isGateway: isGw });
    devices.push({
      id: 'lan_' + entry.ip + '_' + entry.mac,
      category: cls.category,
      label: entry.hostname || cls.vendor + ' (' + entry.ip + ')',
      ip: entry.ip,
      mac: entry.mac,
      vendor: cls.vendor,
      routerRole: hasDoubleNat ? 'secondary' : 'primary',
    });
  }

  const payload = {
    token: TOKEN,
    routers,
    devices,
    scannedAt: Date.now(),
  };

  const res = await fetch(BASE_URL + '/api/topology/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to post topology (' + res.status + ')');
  }
  return payload;
}

const initial = await runNetworkScan();
console.log(
  '[Veloxis LAN Probe] Uploaded',
  initial.routers.length,
  'router(s) and',
  initial.devices.length,
  'device(s) to',
  BASE_URL
);

if (!ONCE) {
  const srv = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url?.startsWith('/scan')) {
      try {
        const result = await runNetworkScan();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, token: TOKEN }));
  });
  srv.listen(47820, '127.0.0.1', () => {
    console.log('[Veloxis LAN Probe] Live local agent listening on http://127.0.0.1:47820 (Ctrl+C to stop)');
  });
}
`;

    res.type('application/javascript; charset=utf-8');
    if (req.query.download === '1') {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="veloxis-lan-probe.mjs"',
      );
    }
    res.send(script);
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
