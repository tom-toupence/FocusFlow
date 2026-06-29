"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultVideos, moodLabels, VideoMood } from "@/data/videos";
import { useSessionStore } from "@/store/sessionStore";
import { useTimerStore, TimerPreset } from "@/store/timerStore";
import { usePrefsStore } from "@/store/prefsStore";
import { cn } from "@/lib/utils";

const MOOD_OPTIONS: { mood: VideoMood; emoji: string }[] = [
  { mood: "lofi", emoji: "🎧" },
  { mood: "jazz", emoji: "🎷" },
  { mood: "nature", emoji: "🌿" },
  { mood: "ambience", emoji: "🌆" },
  { mood: "synthwave", emoji: "🌌" },
  { mood: "classical", emoji: "🎻" },
];

const PRESET_OPTIONS: { preset: TimerPreset; title: string; desc: string }[] = [
  { preset: "classic", title: "Classique", desc: "25 min focus · 5 min pause" },
  { preset: "deep", title: "Deep work", desc: "50 min focus · 10 min pause" },
  { preset: "flowtime", title: "Flowtime", desc: "Sans limite · pause méritée" },
];

export default function Onboarding() {
  const router = useRouter();
  const onboarded = usePrefsStore((s) => s.onboarded);
  const setOnboarded = usePrefsStore((s) => s.setOnboarded);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<VideoMood | null>(null);
  const [preset, setPreset] = useState<TimerPreset>("classic");
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Évite le flash avant l'hydratation du store persisté.
  if (!mounted || onboarded) return null;

  const finish = (launch: boolean) => {
    setOnboarded(true);
    if (launch) {
      const video = (mood && defaultVideos.find((v) => v.mood === mood)) || defaultVideos[0];
      useSessionStore.getState().selectVideo(video.id);
      useTimerStore.getState().applyPreset(preset);
      router.push("/session");
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
      <div className="w-full max-w-md bg-card border border-foreground/10 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-foreground" : "w-1.5 bg-foreground/20")} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Bienvenue sur FocusFlow 👋</h2>
              <p className="text-sm text-foreground/45 mt-1.5">Choisis une ambiance pour ta première session.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOOD_OPTIONS.map((o) => (
                <button
                  key={o.mood}
                  onClick={() => { setMood(o.mood); setStep(1); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground/[0.04] hover:bg-foreground/[0.09] border border-foreground/10 transition-all text-left"
                >
                  <span className="text-2xl">{o.emoji}</span>
                  <span className="text-sm font-medium text-foreground/85">{moodLabels[o.mood]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => finish(false)} className="text-xs text-foreground/35 hover:text-foreground/60 transition-colors self-center">
              Explorer par moi-même
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Quel rythme ?</h2>
              <p className="text-sm text-foreground/45 mt-1.5">Tu pourras changer à tout moment dans les réglages.</p>
            </div>
            <div className="flex flex-col gap-2">
              {PRESET_OPTIONS.map((o) => (
                <button
                  key={o.preset}
                  onClick={() => { setPreset(o.preset); setStep(2); }}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left",
                    preset === o.preset ? "bg-foreground/[0.09] border-foreground/25" : "bg-foreground/[0.04] hover:bg-foreground/[0.08] border-foreground/10"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground/90">{o.title}</p>
                    <p className="text-xs text-foreground/40">{o.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(0)} className="text-xs text-foreground/35 hover:text-foreground/60 transition-colors self-center">← Retour</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Tout est prêt ✦</h2>
              <p className="text-sm text-foreground/45 mt-1.5">
                Ambiance <strong className="text-foreground/70">{mood ? moodLabels[mood] : "Lofi"}</strong> · rythme{" "}
                <strong className="text-foreground/70">{PRESET_OPTIONS.find((p) => p.preset === preset)?.title}</strong>.
              </p>
            </div>
            <button
              onClick={() => finish(true)}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all shadow-lg shadow-black/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Lancer ma première session
            </button>
            <button onClick={() => finish(false)} className="text-xs text-foreground/35 hover:text-foreground/60 transition-colors self-center">
              Plus tard, explorer d&apos;abord
            </button>
          </>
        )}
      </div>
    </div>
  );
}
