import {useCallback, useState} from 'react';
import type {NetworkTopologyReport, WebRtcProbeResult} from '../types/speedtest';
import {getOrCreateDeviceId} from '../utils/deviceDetection';

const TOPOLOGY_TOKEN_KEY = 'veloxis_topology_token_v1';

function getOrCreateTopologyToken(): string {
  try {
    const existing = localStorage.getItem(TOPOLOGY_TOKEN_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const generated = `vx_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
    localStorage.setItem(TOPOLOGY_TOKEN_KEY, generated);
    return generated;
  } catch {
    return `vx_${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function runWebRtcIceProbe(
  observedPublicIp?: string,
): Promise<WebRtcProbeResult> {
  if (typeof RTCPeerConnection === 'undefined') {
    return {
      supported: false,
      probedAt: Date.now(),
      localIps: [],
      reflexiveIps: [],
      mdnsCandidates: 0,
      candidateTypes: [],
      natMismatch: false,
      subnetHint: null,
    };
  }

  return new Promise<WebRtcProbeResult>((resolve) => {
    const localIps = new Set<string>();
    const reflexiveIps = new Set<string>();
    const candidateTypes = new Set<string>();
    let mdnsCandidates = 0;
    let settled = false;

    const finish = (pc?: RTCPeerConnection) => {
      if (settled) return;
      settled = true;
      try {
        pc?.close();
      } catch {
        // Ignore close errors
      }
      const locals = Array.from(localIps);
      const reflexes = Array.from(reflexiveIps);
      const firstPrivate = locals.find(
        (ip) =>
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
      );
      const subnetHint = firstPrivate
        ? `${firstPrivate.split('.').slice(0, 3).join('.')}.0/24`
        : null;
      const natMismatch = Boolean(
        observedPublicIp &&
          reflexes.length > 0 &&
          !reflexes.includes(observedPublicIp),
      );

      resolve({
        supported: true,
        probedAt: Date.now(),
        localIps: locals,
        reflexiveIps: reflexes,
        mdnsCandidates,
        candidateTypes: Array.from(candidateTypes),
        natMismatch,
        subnetHint,
      });
    };

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
      });
      pc.createDataChannel('veloxis-probe');

      const timeout = window.setTimeout(() => finish(pc), 2200);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          window.clearTimeout(timeout);
          finish(pc);
          return;
        }
        const cand = ev.candidate.candidate || '';
        const typeMatch = cand.match(/\styp\s([a-z]+)/i);
        if (typeMatch) {
          candidateTypes.add(typeMatch[1].toLowerCase());
        }
        if (/\.local\b/i.test(cand)) {
          mdnsCandidates += 1;
        }
        const ipMatch = cand.match(
          /candidate:\S+\s+\d+\s+\S+\s+\d+\s+([^\s]+)\s+\d+\s+typ\s+([a-z]+)/i,
        );
        if (ipMatch) {
          const addr = ipMatch[1];
          const typ = ipMatch[2].toLowerCase();
          if (!addr.endsWith('.local')) {
            if (typ === 'host') localIps.add(addr);
            if (typ === 'srflx' || typ === 'prflx') reflexiveIps.add(addr);
          }
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          window.clearTimeout(timeout);
          finish(pc);
        });
    } catch {
      finish();
    }
  });
}

export function useNetworkTopology() {
  const [token] = useState<string>(getOrCreateTopologyToken);
  const [topology, setTopology] = useState<NetworkTopologyReport | null>(null);
  const [webrtcProbe, setWebrtcProbe] = useState<WebRtcProbeResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const runTopologyScan = useCallback(
    async (observedPublicIp?: string) => {
      setIsScanning(true);
      setScanError(null);
      try {
        // Trigger local companion probe if running on localhost (never blocks if absent)
        try {
          await fetch('http://127.0.0.1:47820/scan', {
            method: 'GET',
            signal: AbortSignal.timeout(1800),
          });
        } catch {
          // Local LAN agent not running on 127.0.0.1:47820; continue with server + WebRTC telemetry
        }

        const deviceId = getOrCreateDeviceId();
        const [iceResult, serverRes] = await Promise.all([
          runWebRtcIceProbe(observedPublicIp),
          fetch(
            `/api/topology?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}&t=${Date.now()}`,
            {cache: 'no-store'},
          ),
        ]);

        setWebrtcProbe(iceResult);

        if (!serverRes.ok) {
          throw new Error('Unable to fetch network topology from server.');
        }
        const data = (await serverRes.json()) as NetworkTopologyReport;
        setTopology(data);
        return data;
      } catch (err) {
        setScanError(
          err instanceof Error ? err.message : 'Network topology request failed.',
        );
        return null;
      } finally {
        setIsScanning(false);
      }
    },
    [token],
  );

  return {
    token,
    topology,
    webrtcProbe,
    isScanning,
    scanError,
    runTopologyScan,
  };
}
