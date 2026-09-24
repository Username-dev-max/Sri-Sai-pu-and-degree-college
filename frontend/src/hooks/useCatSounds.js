import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cms_login_sound";

/**
 * Tiny synthesized UI sounds for the login mascot. Tones are generated with
 * WebAudio oscillators rather than shipping audio files, so there is nothing
 * to download and nothing to autoplay — the AudioContext is only created on
 * the first real user interaction, which is also what browser autoplay
 * policies require. Muted by default; the preference is remembered.
 */
export default function useCatSounds() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      return false;
    }
  });
  const ctxRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => () => {
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  const tone = useCallback(
    (freq, duration, { type = "sine", gain = 0.05, slideTo } = {}) => {
      if (!enabled) return;
      try {
        if (!ctxRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          ctxRef.current = new Ctx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
        amp.gain.setValueAtTime(0.0001, ctx.currentTime);
        amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(amp).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
      } catch {
        // audio is entirely optional — never let it break the login flow
      }
    },
    [enabled]
  );

  /**
   * A meow, built from oscillators rather than an audio file so there is
   * nothing to download and nothing that can autoplay.
   *
   * What makes it read as a cat rather than a beep is the shape: the pitch
   * rises quickly, holds, then falls away, while a bandpass filter sweeps
   * across it the way a mouth opening and closing changes the formant. A
   * little vibrato keeps it from sounding synthetic, and a second quieter
   * oscillator a fifth above adds the rasp real meows have.
   */
  const meow = useCallback(
    ({ pitch = 1 } = {}) => {
      if (!enabled) return;
      try {
        if (!ctxRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          ctxRef.current = new Ctx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const t = ctx.currentTime;
        const dur = 0.52;

        const osc = ctx.createOscillator();
        const harm = ctx.createOscillator();
        const amp = ctx.createGain();
        const harmAmp = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const vib = ctx.createOscillator();
        const vibAmp = ctx.createGain();

        osc.type = "sawtooth";
        harm.type = "triangle";
        filter.type = "bandpass";
        filter.Q.value = 5;

        // "me-" rises, "-ow" falls away.
        const base = 480 * pitch;
        osc.frequency.setValueAtTime(base * 0.8, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.1);
        osc.frequency.setValueAtTime(base * 1.5, t + 0.2);
        osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + dur);
        harm.frequency.setValueAtTime(base * 1.2, t);
        harm.frequency.exponentialRampToValueAtTime(base * 2.25, t + 0.1);
        harm.frequency.exponentialRampToValueAtTime(base * 1.08, t + dur);

        // The mouth opening and closing again.
        filter.frequency.setValueAtTime(700 * pitch, t);
        filter.frequency.exponentialRampToValueAtTime(1900 * pitch, t + 0.14);
        filter.frequency.exponentialRampToValueAtTime(620 * pitch, t + dur);

        vib.type = "sine";
        vib.frequency.setValueAtTime(15, t);
        vibAmp.gain.setValueAtTime(base * 0.035, t);
        vib.connect(vibAmp).connect(osc.frequency);

        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(0.10, t + 0.05);
        amp.gain.setValueAtTime(0.10, t + 0.22);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        harmAmp.gain.setValueAtTime(0.028, t);
        harmAmp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter).connect(amp).connect(ctx.destination);
        harm.connect(harmAmp).connect(filter);

        osc.start(t); harm.start(t); vib.start(t);
        osc.stop(t + dur + 0.05); harm.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
      } catch {
        // audio is entirely optional — never let it break the login flow
      }
    },
    [enabled]
  );

  const sounds = {
    type: useCallback(() => tone(660 + Math.random() * 90, 0.05, { type: "triangle", gain: 0.028 }), [tone]),
    thinking: useCallback(() => tone(430, 0.16, { type: "sine", gain: 0.035, slideTo: 560 }), [tone]),
    success: useCallback(() => {
      tone(660, 0.12, { type: "triangle", gain: 0.05 });
      setTimeout(() => tone(880, 0.18, { type: "triangle", gain: 0.05 }), 110);
    }, [tone]),
    error: useCallback(() => tone(320, 0.22, { type: "sine", gain: 0.045, slideTo: 180 }), [tone]),
    meow,
  };

  return { enabled, setEnabled, sounds };
}
