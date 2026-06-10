// Ambient soundscape engine — all sounds are synthesized with the Web Audio API.
// No audio files are loaded: each layer is built from filtered/modulated noise.

export type SoundscapeId = "rain" | "waves" | "wind" | "white" | "fire";

export interface SoundscapeMeta {
  id: SoundscapeId;
  label: string;
  emoji: string;
}

export const SOUNDSCAPES: SoundscapeMeta[] = [
  { id: "rain",  label: "Pluie",       emoji: "🌧️" },
  { id: "waves", label: "Vagues",      emoji: "🌊" },
  { id: "wind",  label: "Vent",        emoji: "🍃" },
  { id: "white", label: "Bruit blanc", emoji: "⚪" },
  { id: "fire",  label: "Feu",         emoji: "🔥" },
];

/** Builds a looping buffer of white noise. */
function makeNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Builds a looping buffer of brown noise (deeper, used for waves/wind). */
function makeBrownBuffer(ctx: AudioContext, seconds = 6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

interface Layer {
  source: AudioBufferSourceNode;
  gain: GainNode;
  extras: AudioNode[];
  lfos: OscillatorNode[];
}

export interface SoundscapeEngine {
  setLayerVolume: (id: SoundscapeId, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  resume: () => Promise<void>;
  destroy: () => void;
}

/**
 * Creates the audio graph for every soundscape. Layers start silent (gain 0);
 * raising a layer's volume fades it in. Cheap to keep all running at gain 0.
 */
export function createSoundscapeEngine(): SoundscapeEngine | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const white = makeNoiseBuffer(ctx);
  const brown = makeBrownBuffer(ctx);

  const layers = new Map<SoundscapeId, Layer>();

  function startSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  // ── Rain: white noise through a bandpass with subtle amplitude shimmer ──
  {
    const src = startSource(white);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const shimmer = ctx.createOscillator();
    shimmer.frequency.value = 0.7;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.06;
    shimmer.connect(shimmerGain).connect(gain.gain);
    shimmer.start();
    src.connect(bp).connect(hp).connect(gain).connect(master);
    layers.set("rain", { source: src, gain, extras: [bp, hp, shimmerGain], lfos: [shimmer] });
  }

  // ── Waves: brown noise with a slow swell (LFO on gain) ──
  {
    const src = startSource(brown);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.12;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.5;
    swell.connect(swellGain).connect(gain.gain);
    swell.start();
    src.connect(lp).connect(gain).connect(master);
    layers.set("waves", { source: src, gain, extras: [lp, swellGain], lfos: [swell] });
  }

  // ── Wind: brown noise through a lowpass whose cutoff sweeps slowly ──
  {
    const src = startSource(brown);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.08;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 300;
    sweep.connect(sweepGain).connect(lp.frequency);
    sweep.start();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(master);
    layers.set("wind", { source: src, gain, extras: [lp, sweepGain], lfos: [sweep] });
  }

  // ── White noise: gentle softening lowpass ──
  {
    const src = startSource(white);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 8000;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(master);
    layers.set("white", { source: src, gain, extras: [lp], lfos: [] });
  }

  // ── Fire: lowpassed brown noise + fast crackle modulation ──
  {
    const src = startSource(brown);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const crackle = ctx.createOscillator();
    crackle.type = "square";
    crackle.frequency.value = 11;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.12;
    crackle.connect(crackleGain).connect(gain.gain);
    crackle.start();
    src.connect(lp).connect(gain).connect(master);
    layers.set("fire", { source: src, gain, extras: [lp, crackleGain], lfos: [crackle] });
  }

  return {
    setLayerVolume(id, volume) {
      const layer = layers.get(id);
      if (!layer) return;
      const v = Math.max(0, Math.min(1, volume));
      const now = ctx.currentTime;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setTargetAtTime(v, now, 0.15);
    },
    setMasterVolume(volume) {
      const v = Math.max(0, Math.min(1, volume));
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    async resume() {
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch { /* ignore */ }
      }
    },
    destroy() {
      layers.forEach((layer) => {
        try {
          layer.source.stop();
          layer.lfos.forEach((o) => o.stop());
        } catch { /* already stopped */ }
      });
      ctx.close().catch(() => {});
    },
  };
}
