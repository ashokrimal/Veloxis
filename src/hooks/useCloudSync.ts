import {useCallback, useEffect, useRef, useState} from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {OperationType, auth, db, googleProvider, handleFirestoreError} from '../firebase';
import type {
  BenchmarkProfile,
  DetectedDevice,
  SpeedTestResult,
  SpeedUnit,
} from '../types/speedtest';
import {evaluateActivities, evaluateBufferbloat} from '../utils/scoring';

const TAB_CHANNEL_NAME = 'veloxis_tab_sync_v1';

interface TabSyncMessage {
  type: 'test-saved' | 'settings-updated' | 'history-cleared';
  payload?: unknown;
}

interface CloudSyncOptions {
  onReceiveRemoteTests: (tests: SpeedTestResult[]) => void;
  onReceiveRemoteSettings: (settings: {
    profile?: Partial<BenchmarkProfile>;
    speedUnit?: SpeedUnit;
    watchIntervalMin?: number;
    watchThresholdPct?: number;
  }) => void;
  onReceiveRemoteDevices: (devices: DetectedDevice[]) => void;
  onLocalTabTest?: (test: SpeedTestResult) => void;
  onLocalTabHistoryCleared?: () => void;
}

export function useCloudSync(options: CloudSyncOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSyncedCount, setCloudSyncedCount] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // BroadcastChannel for real-time local browser tab synchronization
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(TAB_CHANNEL_NAME);
    channelRef.current = bc;
    bc.onmessage = (event: MessageEvent<TabSyncMessage>) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'test-saved' && msg.payload) {
        callbacksRef.current.onLocalTabTest?.(msg.payload as SpeedTestResult);
      } else if (msg.type === 'settings-updated' && msg.payload) {
        callbacksRef.current.onReceiveRemoteSettings(
          msg.payload as {
            profile?: Partial<BenchmarkProfile>;
            speedUnit?: SpeedUnit;
            watchIntervalMin?: number;
            watchThresholdPct?: number;
          },
        );
      } else if (msg.type === 'history-cleared') {
        callbacksRef.current.onLocalTabHistoryCleared?.();
      }
    };
    return () => {
      bc.close();
      channelRef.current = null;
    };
  }, []);

  const broadcastTabMessage = useCallback((msg: TabSyncMessage) => {
    try {
      channelRef.current?.postMessage(msg);
    } catch {
      // Ignore postMessage failures
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      if (nextUser && nextUser.emailVerified) {
        const userPath = `users/${nextUser.uid}`;
        try {
          await setDoc(
            doc(db, 'users', nextUser.uid),
            {
              uid: nextUser.uid,
              displayName: (nextUser.displayName || 'Veloxis User').slice(0, 120),
              ...(nextUser.email ? {email: nextUser.email.slice(0, 254)} : {}),
              updatedAt: serverTimestamp(),
            },
            {merge: true},
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners while authenticated
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setCloudSyncedCount(0);
      return;
    }

    const uid = user.uid;
    const settingsDocPath = `users/${uid}/settings/profile`;
    const unsubSettings = onSnapshot(
      doc(db, 'users', uid, 'settings', 'profile'),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacksRef.current.onReceiveRemoteSettings({
          profile: {
            planName: typeof d.planName === 'string' ? d.planName : '',
            subscribedDownloadMbps:
              typeof d.subscribedDownloadMbps === 'number'
                ? d.subscribedDownloadMbps
                : null,
            subscribedUploadMbps:
              typeof d.subscribedUploadMbps === 'number'
                ? d.subscribedUploadMbps
                : null,
            monthlyPrice:
              typeof d.monthlyPrice === 'number' ? d.monthlyPrice : null,
            currencyCode:
              typeof d.currencyCode === 'string' ? d.currencyCode : '',
          },
          speedUnit: d.speedUnit === 'MBps' ? 'MBps' : 'Mbps',
          watchIntervalMin:
            typeof d.watchIntervalMin === 'number' ? d.watchIntervalMin : 0,
          watchThresholdPct:
            typeof d.watchThresholdPct === 'number' ? d.watchThresholdPct : 70,
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, settingsDocPath),
    );

    const testsPath = `users/${uid}/tests`;
    const testsQuery = query(
      collection(db, 'users', uid, 'tests'),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubTests = onSnapshot(
      testsQuery,
      (snap) => {
        const cloudRuns: SpeedTestResult[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const dl = Number(d.downloadMbps) || 0;
          const ul = Number(d.uploadMbps) || 0;
          const ping = Number(d.pingMs) || 0;
          const loaded = Number(d.loadedPingMs) || ping;
          const jitter = Number(d.jitterMs) || 0;
          const loss = Number(d.packetLossPct) || 0;
          return {
            id: String(d.id || docSnap.id),
            timestamp: String(d.timestamp || new Date().toISOString()),
            mode:
              d.mode === 'file' || d.mode === 'realtime'
                ? d.mode
                : 'precision',
            downloadMbps: dl,
            uploadMbps: ul,
            pingMs: ping,
            loadedPingMs: loaded,
            jitterMs: jitter,
            packetLossPct: loss,
            veloxisScore: Number(d.veloxisScore) || 0,
            bufferbloatGrade:
              d.bufferbloatGrade || evaluateBufferbloat(ping, loaded).grade,
            durationSec:
              typeof d.durationSec === 'number' ? d.durationSec : undefined,
            activities: evaluateActivities({
              downloadMbps: dl,
              uploadMbps: ul,
              pingMs: ping,
              loadedPingMs: loaded,
              jitterMs: jitter,
              packetLossPct: loss,
            }),
            network: {
              ip: '',
              isp: typeof d.isp === 'string' ? d.isp : 'Cloud Synced',
              asn: '',
              city: '',
              region: '',
              country: typeof d.country === 'string' ? d.country : '',
              countryCode: '',
              currencyCode: '',
              serverNode:
                typeof d.serverNode === 'string'
                  ? d.serverNode
                  : 'Veloxis Edge',
              detected: true,
            },
            samples: [],
          };
        });
        setCloudSyncedCount(cloudRuns.length);
        callbacksRef.current.onReceiveRemoteTests(cloudRuns);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, testsPath),
    );

    const devicesPath = `users/${uid}/devices`;
    const devicesQuery = query(
      collection(db, 'users', uid, 'devices'),
      where('ownerUid', '==', uid),
      limit(20),
    );

    const unsubDevices = onSnapshot(
      devicesQuery,
      (snap) => {
        const list: DetectedDevice[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const bytesDown = Number(d.bytesDown) || 0;
          const bytesUp = Number(d.bytesUp) || 0;
          return {
            deviceId: String(d.deviceId || docSnap.id),
            label: String(d.label || 'Synced Device'),
            os: String(d.os || 'Unknown OS'),
            browser: String(d.browser || 'Browser'),
            deviceType:
              d.deviceType === 'Mobile' || d.deviceType === 'Tablet'
                ? d.deviceType
                : 'Desktop',
            isCurrentDevice: false,
            linkType: String(d.linkType || 'Broadband'),
            rttMs: Number(d.rttMs) || 0,
            bytesDown,
            bytesUp,
            totalBytesUsed: bytesDown + bytesUp,
            bandwidthShareMbps: Number(d.downloadMbps) || 0,
            estimatedGbPerHour: null,
            usagePct: 0,
            status: 'Active',
            lastSeenAt: Date.now(),
          };
        });
        callbacksRef.current.onReceiveRemoteDevices(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, devicesPath),
    );

    return () => {
      unsubSettings();
      unsubTests();
      unsubDevices();
    };
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in popup blocked or unavailable in this browser.');
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const pushTestRunToCloud = useCallback(
    async (run: SpeedTestResult) => {
      broadcastTabMessage({type: 'test-saved', payload: run});
      if (!user || !user.emailVerified) return;
      const safeId = run.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const path = `users/${user.uid}/tests/${safeId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'tests', safeId), {
          id: safeId,
          ownerUid: user.uid,
          timestamp: run.timestamp.slice(0, 64),
          mode: run.mode,
          downloadMbps: run.downloadMbps,
          uploadMbps: run.uploadMbps,
          pingMs: run.pingMs,
          loadedPingMs: run.loadedPingMs,
          jitterMs: run.jitterMs,
          packetLossPct: run.packetLossPct,
          veloxisScore: run.veloxisScore,
          bufferbloatGrade:
            run.bufferbloatGrade ??
            evaluateBufferbloat(run.pingMs, run.loadedPingMs).grade,
          serverNode: (run.network.serverNode || 'Veloxis Edge').slice(0, 100),
          isp: (run.network.isp || 'Unknown').slice(0, 120),
          country: (run.network.country || '').slice(0, 80),
          ...(run.durationSec !== undefined ? {durationSec: run.durationSec} : {}),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [broadcastTabMessage, user],
  );

  const pushSettingsToCloud = useCallback(
    async (settings: {
      profile: BenchmarkProfile;
      speedUnit: SpeedUnit;
      watchIntervalMin: number;
      watchThresholdPct: number;
    }) => {
      broadcastTabMessage({type: 'settings-updated', payload: settings});
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/settings/profile`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'settings', 'profile'),
          {
            ownerUid: user.uid,
            planName: (settings.profile.planName || '').slice(0, 80),
            subscribedDownloadMbps: settings.profile.subscribedDownloadMbps,
            subscribedUploadMbps: settings.profile.subscribedUploadMbps,
            monthlyPrice: settings.profile.monthlyPrice,
            currencyCode: (settings.profile.currencyCode || '').slice(0, 8),
            speedUnit: settings.speedUnit,
            watchIntervalMin: settings.watchIntervalMin,
            watchThresholdPct: settings.watchThresholdPct,
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [broadcastTabMessage, user],
  );

  const pushDeviceToCloud = useCallback(
    async (device: DetectedDevice) => {
      if (!user || !user.emailVerified || !device.isCurrentDevice) return;
      const safeDevId = device.deviceId
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 128);
      const path = `users/${user.uid}/devices/${safeDevId}`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'devices', safeDevId),
          {
            deviceId: safeDevId,
            ownerUid: user.uid,
            label: device.label.slice(0, 80),
            os: device.os.slice(0, 40),
            browser: device.browser.slice(0, 40),
            deviceType: device.deviceType,
            linkType: device.linkType.slice(0, 32),
            rttMs: Math.max(0, device.rttMs),
            bytesDown: Math.max(0, device.bytesDown),
            bytesUp: Math.max(0, device.bytesUp),
            downloadMbps: Math.max(0, device.bandwidthShareMbps),
            uploadMbps: 0,
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [user],
  );

  return {
    user,
    authLoading,
    authError,
    cloudSyncedCount,
    signInWithGoogle,
    signOutUser,
    pushTestRunToCloud,
    pushSettingsToCloud,
    pushDeviceToCloud,
    broadcastHistoryCleared: () =>
      broadcastTabMessage({type: 'history-cleared'}),
  };
}
