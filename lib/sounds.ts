// Chime sounds generated with the Web Audio API (no external files needed)

function playChime(notes: number[], volume: number) {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
    setTimeout(() => ctx.close(), (notes.length * 0.22 + 0.8) * 1000);
  } catch { /* ignore if AudioContext not available */ }
}

/** Soft descending chime — signals the start of a break */
export function playBreakChime() {
  playChime([659, 523, 392], 0.14); // E5 → C5 → G4
}

/** Bright ascending chime — signals the start of a work session */
export function playWorkChime() {
  playChime([392, 523, 659], 0.16); // G4 → C5 → E5
}
