import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
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
  const endpoint = isPrivateIp(cleanIp)
    ? 'https://ipwho.is/'
    : `https://ipwho.is/${encodeURIComponent(cleanIp)}`;

  try {
    const res = await fetch(endpoint, {
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
        connection?: {isp?: string; org?: string; asn?: number};
      };
      if (data.success !== false) {
        return {
          ip: data.ip || cleanIp,
          isp: data.connection?.isp || data.connection?.org || 'Detected Broadband ISP',
          asn: data.connection?.asn ? `AS${data.connection.asn}` : 'AS-AUTO',
          city: data.city || 'Edge Metro',
          region: data.region || '',
          country: data.country || '',
          serverNode: 'Veloxis Edge · Cloud Run',
          detected: true,
        };
      }
    }
  } catch {
    // Graceful fallback when sandboxed or offline
  }

  return {
    ip: cleanIp,
    isp: isPrivateIp(cleanIp) ? 'Local / Direct Network' : 'Broadband Network',
    asn: 'AS-LOCAL',
    city: 'Local Gateway',
    region: '',
    country: '',
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

  app.get('/api/speedtest/ping', (_req, res) => {
    res.json({ok: true, serverTime: Date.now()});
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

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Veloxis telemetry server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
