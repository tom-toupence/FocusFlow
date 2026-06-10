"use client";

import { useEffect, useRef, useState } from "react";
import { createSoundscapeEngine, SoundscapeEngine, SOUNDSCAPES, SoundscapeId } from "@/lib/soundscapes";
import { useSoundscapeStore } from "@/store/soundscapeStore";
import { cn } from "@/lib/utils";

/**
 * Floating ambient-sound mixer. Layers are synthesized with the Web Audio API
 * and overlay on top of whatever music source is playing (YouTube/Spotify/Twitch).
 *
 * `active` controls whether the layers are audible (e.g. pause during breaks when
 * the user opted in). The engine keeps running silently to avoid re-init clicks.
 */
export default function SoundscapeMixer({
  open,
  onClose,
  active,
}: {
  open: boolean;
  onClose: () => void;
  active: boolean;
}) {
  const { layers, masterVolume, pauseOnBreak, setLayer, setMasterVolume, setPauseOnBreak } = useSoundscapeStore();
  const engineRef = useRef<SoundscapeEngine | null>(null);
  const [ready, setReady] = useState(false);

  // Create the engine once, lazily.
  useEffect(() => {
    const engine = createSoundscapeEngine();
    engineRef.current = engine;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(!!engine);
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Push every layer's effective volume to the engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resume();
    for (const { id } of SOUNDSCAPES) {
      const v = active ? layers[id] ?? 0 : 0;
      engine.setLayerVolume(id, v);
    }
  }, [layers, active, ready]);

  useEffect(() => {
    engineRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume, ready]);

  const handleLayer = (id: SoundscapeId, v: number) => {
    engineRef.current?.resume();
    setLayer(id, v);
  };

  if (!open) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[340px] bg-black/85 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/80 overflow-hidden z-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 18V5l12-2v13M9 13l12-2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Ambiances</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!ready ? (
        <p className="text-white/40 text-xs text-center py-8 px-4">Audio non disponible sur ce navigateur.</p>
      ) : (
        <div className="p-4 flex flex-col gap-3.5">
          {SOUNDSCAPES.map(({ id, label, emoji }) => {
            const v = layers[id] ?? 0;
            const on = v > 0.01;
            return (
              <div key={id} className="flex items-center gap-3">
                <button
                  onClick={() => handleLayer(id, on ? 0 : 0.5)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all",
                    on ? "bg-white/20 ring-1 ring-white/30" : "bg-white/5 hover:bg-white/10 opacity-60"
                  )}
                  title={on ? `Couper ${label}` : `Activer ${label}`}
                >
                  <span>{emoji}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[11px] font-medium", on ? "text-white/80" : "text-white/40")}>{label}</span>
                    {on && <span className="text-[10px] text-white/30 tabular-nums">{Math.round(v * 100)}%</span>}
                  </div>
                  <input
                    type="range"
                    min={0} max={1} step={0.02}
                    value={v}
                    onChange={(e) => handleLayer(id, parseFloat(e.target.value))}
                    className="w-full h-1 accent-white/90 cursor-pointer"
                  />
                </div>
              </div>
            );
          })}

          {/* Master + options */}
          <div className="border-t border-white/10 pt-3 mt-1 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-white/50 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
              </svg>
              <input
                type="range"
                min={0} max={1} step={0.02}
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-white/90 cursor-pointer"
                title="Volume des ambiances"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pauseOnBreak}
                onChange={(e) => setPauseOnBreak(e.target.checked)}
                className="accent-white/90"
              />
              <span className="text-[11px] text-white/50">Couper les ambiances pendant les pauses</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
