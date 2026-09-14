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

  const sounds = {
    type: useCallback(() => tone(660 + Math.random() * 90, 0.05, { type: "triangle", gain: 0.028 }), [tone]),
    thinking: useCallback(() => tone(430, 0.16, { type: "sine", gain: 0.035, slideTo: 560 }), [tone]),
    success: useCallback(() => {
      tone(660, 0.12, { type: "triangle", gain: 0.05 });
      setTimeout(() => tone(880, 0.18, { type: "triangle", gain: 0.05 }), 110);
    }, [tone]),
    error: useCallback(() => tone(320, 0.22, { type: "sine", gain: 0.045, slideTo: 180 }), [tone]),
  };

  return { enabled, setEnabled, sounds };
}
