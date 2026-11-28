import {useCallback, useEffect, useRef, useState} from 'react';
import type {TestPhase} from '../types/speedtest';

const MUTE_STORAGE_KEY = 'veloxis_audio_muted_v1';

function loadMutedPreference(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useTelemetryAudio() {
  const [isMuted, setIsMuted] = useState<boolean>(loadMutedPreference);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const mutedRef = useRef<boolean>(isMuted);

  useEffect(() => {
    mutedRef.current = isMuted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted));
    } catch {
      // Ignore storage errors
    }

    if (masterGainRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.14, now, 0.02);
    }
  }, [isMuted]);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2600;
      filter.Q.value = 0.7;

      const master = ctx.createGain();
      master.gain.value = mutedRef.current ? 0 : 0.14;

      filter.connect(master);
      master.connect(ctx.destination);

      ctxRef.current = ctx;
      filterRef.current = filter;
      masterGainRef.current = master;
    }

    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  const scheduleTone = useCallback(
    (opts: {
      freq: number;
      endFreq?: number;
      delay?: number;
      duration: number;
      gain: number;
      type?: OscillatorType;
    }) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx || !filterRef.current) return;

      const now = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = opts.type ?? 'sine';
      osc.frequency.setValueAtTime(opts.freq, now);
      if (opts.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          opts.endFreq,
          now + opts.duration,
        );
      }

      // Soft click-free ADSR envelope
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(opts.gain, now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

      osc.connect(env);
      env.connect(filterRef.current);

      osc.start(now);
      osc.stop(now + opts.duration + 0.02);
    },
    [ensureContext],
  );

  const unlockAudio = useCallback(() => {
    ensureContext();
  }, [ensureContext]);

  const playStart = useCallback(() => {
    unlockAudio();
    scheduleTone({freq: 523.25, duration: 0.18, gain: 0.35, type: 'sine'});
    scheduleTone({
      freq: 783.99,
      delay: 0.065,
      duration: 0.24,
      gain: 0.28,
      type: 'sine',
    });
  }, [scheduleTone, unlockAudio]);

  const playPhaseTransition = useCallback(
    (phase: TestPhase) => {
      if (phase === 'download') {
        scheduleTone({freq: 587.33, duration: 0.12, gain: 0.22, type: 'triangle'});
        scheduleTone({
          freq: 880,
          delay: 0.055,
          duration: 0.16,
          gain: 0.18,
          type: 'sine',
        });
      } else if (phase === 'upload') {
        scheduleTone({freq: 659.25, duration: 0.12, gain: 0.22, type: 'triangle'});
        scheduleTone({
          freq: 987.77,
          delay: 0.055,
          duration: 0.16,
          gain: 0.18,
          type: 'sine',
        });
      }
    },
    [scheduleTone],
  );

  const playProgressTick = useCallback(
    (progressPct: number) => {
      const clamped = Math.max(0, Math.min(100, progressPct));
      const freq = 440 + (clamped / 100) * 220;
      scheduleTone({
        freq,
        duration: 0.065,
        gain: 0.12,
        type: 'sine',
      });
    },
    [scheduleTone],
  );

  const playComplete = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1174.66];
    notes.forEach((freq, idx) => {
      scheduleTone({
        freq,
        delay: idx * 0.06,
        duration: idx === notes.length - 1 ? 0.42 : 0.28,
        gain: idx === notes.length - 1 ? 0.26 : 0.2,
        type: 'sine',
      });
    });
  }, [scheduleTone]);

  const playCancel = useCallback(() => {
    scheduleTone({
      freq: 415.3,
      endFreq: 293.66,
      duration: 0.15,
      gain: 0.2,
      type: 'sine',
    });
  }, [scheduleTone]);

  const playClick = useCallback(() => {
    scheduleTone({
      freq: 640,
      endFreq: 520,
      duration: 0.04,
      gain: 0.08,
      type: 'sine',
    });
  }, [scheduleTone]);

  const playSuccess = useCallback(() => {
    unlockAudio();
    scheduleTone({freq: 587.33, duration: 0.1, gain: 0.16, type: 'sine'});
    scheduleTone({
      freq: 880,
      delay: 0.055,
      duration: 0.16,
      gain: 0.15,
      type: 'sine',
    });
  }, [scheduleTone, unlockAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (!next) {
        ensureContext();
        // Subtle confirmation tone when re-enabling sound
        window.setTimeout(() => {
          scheduleTone({freq: 659.25, duration: 0.09, gain: 0.18, type: 'sine'});
        }, 20);
      }
      return next;
    });
  }, [ensureContext, scheduleTone]);

  return {
    isMuted,
    toggleMute,
    unlockAudio,
    playStart,
    playPhaseTransition,
    playProgressTick,
    playComplete,
    playCancel,
    playClick,
    playSuccess,
  };
}
