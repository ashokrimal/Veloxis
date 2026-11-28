import {useCallback, useEffect, useState} from 'react';
import type {CalibrationDeviceInfo} from '../types/speedtest';

const PERM_STORAGE_KEY = 'veloxis_calibration_perm_v1';
const CALIBRATION_DATA_KEY = 'veloxis_calibration_data_v1';

export type CalibrationStatus = 'prompt' | 'granted' | 'dismissed' | 'denied';

export interface CalibratedLocation {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  accuracyKm?: number;
}

interface StoredCalibration {
  location: CalibratedLocation | null;
  device: CalibrationDeviceInfo | null;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function loadStatus(): CalibrationStatus {
  try {
    const raw = localStorage.getItem(PERM_STORAGE_KEY);
    if (
      raw === 'granted' ||
      raw === 'dismissed' ||
      raw === 'denied' ||
      raw === 'prompt'
    ) {
      return raw;
    }
    return 'prompt';
  } catch {
    return 'prompt';
  }
}

function loadStoredData(): StoredCalibration {
  try {
    const raw = localStorage.getItem(CALIBRATION_DATA_KEY);
    if (!raw) return {location: null, device: null};
    return JSON.parse(raw) as StoredCalibration;
  } catch {
    return {location: null, device: null};
  }
}

async function readDeviceCalibration(): Promise<CalibrationDeviceInfo> {
  const nav = navigator as unknown as {
    hardwareConcurrency?: number;
    deviceMemory?: number;
    userAgentData?: {
      getHighEntropyValues?: (
        hints: string[],
      ) => Promise<{model?: string; platformVersion?: string}>;
    };
    connection?: {
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
  };

  let deviceModel: string | undefined;
  let platformVersion: string | undefined;
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const vals = await nav.userAgentData.getHighEntropyValues([
        'model',
        'platformVersion',
      ]);
      if (vals.model) deviceModel = vals.model;
      if (vals.platformVersion) platformVersion = vals.platformVersion;
    }
  } catch {
    // Ignore unsupported high-entropy hints
  }

  const cpuCores =
    typeof nav.hardwareConcurrency === 'number'
      ? nav.hardwareConcurrency
      : undefined;
  const memoryGb =
    typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const effectiveType = nav.connection?.effectiveType;
  const downlinkMbps =
    typeof nav.connection?.downlink === 'number'
      ? nav.connection.downlink
      : undefined;
  const saveData = Boolean(nav.connection?.saveData);

  const constrained =
    saveData ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    effectiveType === '3g' ||
    (cpuCores !== undefined && cpuCores <= 2);

  return {
    deviceModel,
    platformVersion,
    cpuCores,
    memoryGb,
    effectiveType,
    downlinkMbps,
    saveData,
    recommendedStreams: constrained ? 2 : 4,
  };
}

export function useCalibrationPermissions() {
  const [status, setStatus] = useState<CalibrationStatus>(loadStatus);
  const [isRequesting, setIsRequesting] = useState(false);
  const [location, setLocation] = useState<CalibratedLocation | null>(
    () => loadStoredData().location,
  );
  const [device, setDevice] = useState<CalibrationDeviceInfo | null>(
    () => loadStoredData().device,
  );

  useEffect(() => {
    try {
      localStorage.setItem(PERM_STORAGE_KEY, status);
    } catch {
      // Ignore storage errors
    }
  }, [status]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CALIBRATION_DATA_KEY,
        JSON.stringify({location, device}),
      );
    } catch {
      // Ignore storage errors
    }
  }, [device, location]);

  const acquireGeolocation = useCallback(async (): Promise<CalibratedLocation | null> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return null;
    }

    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300_000,
      });
    }).catch(() => null);

    if (!pos) return null;

    const lat = Number(pos.coords.latitude.toFixed(4));
    const lon = Number(pos.coords.longitude.toFixed(4));
    const accuracyKm = Math.max(
      1,
      Math.min(50, Math.round((pos.coords.accuracy || 1500) / 1000)),
    );
    let nextLoc: CalibratedLocation = {lat, lon, accuracyKm};

    try {
      const geoRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        {signal: AbortSignal.timeout(4000)},
      );
      if (geoRes.ok) {
        const g = (await geoRes.json()) as {
          city?: string;
          locality?: string;
          principalSubdivision?: string;
          countryName?: string;
          countryCode?: string;
        };
        nextLoc = {
          lat,
          lon,
          accuracyKm,
          city: g.city || g.locality || '',
          region: g.principalSubdivision || '',
          country: g.countryName || '',
          countryCode: g.countryCode || '',
        };
      }
    } catch {
      // Keep coordinates even if reverse-geocoding fails
    }

    setLocation(nextLoc);
    return nextLoc;
  }, []);

  // Refresh device specs (and geolocation if browser permission is already granted)
  useEffect(() => {
    if (status === 'granted') {
      void readDeviceCalibration().then(setDevice);
      if (!location && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({name: 'geolocation'})
          .then((perm) => {
            if (perm.state === 'granted') {
              void acquireGeolocation();
            }
          })
          .catch(() => {});
      }
    }
  }, [acquireGeolocation, location, status]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      const devInfo = await readDeviceCalibration();
      setDevice(devInfo);
      await acquireGeolocation();
      setStatus('granted');
      return true;
    } catch {
      setStatus('denied');
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [acquireGeolocation]);

  const dismissPrompt = useCallback(() => {
    setStatus('dismissed');
  }, []);

  const clearCalibration = useCallback(() => {
    setLocation(null);
    setDevice(null);
    setStatus('prompt');
    try {
      localStorage.removeItem(CALIBRATION_DATA_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    status,
    isRequesting,
    location,
    device,
    requestPermissions,
    dismissPrompt,
    clearCalibration,
  };
}
