"use client";
// La télécommande, côté téléphone (lot 7) : /remote/<code>, sans compte.
// Affiche le temps restant de l'ordinateur (calculé depuis son échéance, donc
// sans dérive) et envoie Pause/Reprendre, Distraction, Suivant. Marche tant que
// l'écran du téléphone est allumé (Wake Lock demandé quand le navigateur l'a).
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/timerClock";
import { formatHM } from "@/lib/stopPlan";
import { openTransport, type RemoteTransport } from "@/lib/remote/transport";
import {
  displaySeconds, HOST_TIMEOUT_MS, makeMessage, newNonce, normalizeCode, ReplayGuard, STATE_INTERVAL_MS,
  type RemoteCommand, type RemoteState,
} from "@/lib/remote/protocol";
import { useWakeLock } from "./useWakeLock";

type Status = "connecting" | "live" | "lost" | "expired" | "ended" | "handed" | "invalid" | "unavailable";

const MODE_LABEL: Record<RemoteState["mode"], string> = { work: "Focus", "short-break": "Pause courte", "long-break": "Longue pause" };

export default function RemoteClient({ rawCode }: { rawCode: string }) {
  const code = normalizeCode(rawCode);
  const [status, setStatus] = useState<Status>(code ? "connecting" : "invalid");
  const [state, setState] = useState<RemoteState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState(0);
  const transportRef = useRef<RemoteTransport | null>(null);
  const [helloId] = useState(() => newNonce());
  useWakeLock(status === "live");

  useEffect(() => {
    if (!code) return;
    const t = openTransport(code);
    if (!t) { setStatus("unavailable"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    transportRef.current = t;
    const guard = new ReplayGuard();
    let lastState = Date.now();
    let finished = false;
    const hello = () => void t.send(makeMessage({ type: "hello", role: "remote", id: helloId }));
    const unsub = t.onMessage((raw) => {
      const m = guard.accept(raw);
      if (!m || finished) return;
      if (m.type === "state") {
        lastState = Date.now();
        setOffset(Date.now() - m.t);
        setState(m.s);
        setStatus(m.t >= m.s.expiresAt ? "expired" : "live");
      } else if (m.type === "bye") {
        finished = true;
        setStatus(m.reason === "expired" ? "expired" : m.reason === "handed-off" ? "handed" : "ended");
      }
    });
    hello();
    const beat = setInterval(() => {
      if (finished) return;
      hello();
      if (Date.now() - lastState > HOST_TIMEOUT_MS) setStatus("lost");
    }, STATE_INTERVAL_MS);
    // Premier verdict « introuvable » à 10 s, sans attendre le battement suivant.
    const first = setTimeout(() => { if (!finished && Date.now() - lastState >= HOST_TIMEOUT_MS - 50) setStatus("lost"); }, HOST_TIMEOUT_MS);
    return () => { clearInterval(beat); clearTimeout(first); unsub(); t.close(); transportRef.current = null; };
  }, [code, helloId]);

  // Horloge d'affichage : une fois par seconde.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Code arrivé à échéance pendant qu'on regarde.
  const expired = state != null && now > 0 && now - offset >= state.expiresAt;
  const shown: Status = status === "live" && expired ? "expired" : status;

  const send = (cmd: RemoteCommand) => {
    void transportRef.current?.send(makeMessage({ type: "cmd", cmd }));
    if (cmd === "distraction") setFlash((n) => n + 1);
  };

  if (shown !== "live") return <RemoteMessage status={shown} />;
  if (!state) return <RemoteMessage status="connecting" />;

  const seconds = now > 0 ? displaySeconds(state, offset, now) : state.seconds;
  const progress = !state.flow && state.total > 0 ? Math.min(1, Math.max(0, 1 - seconds / state.total)) : 0;
  const label = state.flow ? "Flow" : MODE_LABEL[state.mode];

  return (
    <main className="min-h-[100dvh] bg-night text-white flex flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
          Ordinateur · {label}{state.running ? "" : " · en pause"}
        </p>
        <p
          role="timer"
          data-testid="remote-time"
          aria-label={`${state.flow ? "Flow" : "Temps restant"} : ${formatClock(seconds)}`}
          className="mt-3 font-mono tabular-nums leading-none text-sodium text-[clamp(4.5rem,24vw,8rem)] [text-shadow:0_0_18px_color-mix(in_oklab,var(--sodium)_45%,transparent)]"
        >
          {formatClock(seconds)}
        </p>
        <div aria-hidden className="mx-auto mt-4 h-[2px] w-40 overflow-hidden bg-white/10">
          <div className="h-full origin-left bg-sodium transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${progress})` }} />
        </div>
        {state.title && <p data-testid="remote-title" className="mt-4 truncate text-sm text-white/75">{state.title}</p>}
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
          {state.flow ? "Flowtime" : `Pomodoro ${state.pomodoro}`}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <button
          onClick={() => send(state.running ? "pause" : "resume")}
          className="ff-press h-28 rounded-2xl bg-white text-black text-xl font-medium active:bg-white/85"
        >
          {state.running ? "Pause" : "Reprendre"}
        </button>
        <div className={cn("grid gap-3", state.caps.skip ? "grid-cols-2" : "grid-cols-1")}>
          <button
            onClick={() => send("distraction")}
            disabled={state.mode !== "work"}
            className="ff-press relative h-20 rounded-2xl border border-white/15 bg-white/[0.04] text-base text-white/90 active:bg-white/10 disabled:opacity-40"
          >
            Distraction
            {state.distractions > 0 && <span data-testid="remote-distractions" className="ml-2 font-mono tabular-nums text-rose-300">{state.distractions}</span>}
            {flash > 0 && (
              <span key={flash} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-rose-300 animate-[distractionPop_0.7s_ease-out_forwards]">+1</span>
            )}
          </button>
          {state.caps.skip && (
            <button
              onClick={() => send("next")}
              className="ff-press h-20 rounded-2xl border border-white/15 bg-white/[0.04] text-base text-white/90 active:bg-white/10"
            >
              Suivant
            </button>
          )}
        </div>
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/55">
          Sans compte. Code valable jusqu&apos;à {formatHM(state.expiresAt + offset)}. Marche tant que l&apos;écran du téléphone est allumé.
        </p>
      </div>
    </main>
  );
}

const MESSAGES: Record<Exclude<Status, "live">, { title: string; body: string }> = {
  connecting: { title: "Connexion à l'ordinateur…", body: "Garde la session ouverte sur l'ordinateur." },
  lost: { title: "Ordinateur introuvable", body: "Vérifie que la session est ouverte sur l'ordinateur et que le code est le bon. On réessaie tout seul." },
  expired: { title: "Code expiré", body: "Ouvre la télécommande sur l'ordinateur pour avoir un nouveau code." },
  ended: { title: "Télécommande déconnectée", body: "La session est terminée sur l'ordinateur, ou la télécommande a été coupée." },
  handed: { title: "Session transférée", body: "La session continue sur un téléphone." },
  invalid: { title: "Code invalide", body: "Le code fait 6 caractères. Scanne à nouveau le QR code de l'ordinateur." },
  unavailable: { title: "Télécommande indisponible", body: "Cette version de FocusFlow n'a pas de canal pour la télécommande." },
};

function RemoteMessage({ status }: { status: Exclude<Status, "live"> }) {
  const m = MESSAGES[status];
  return (
    <main className="min-h-[100dvh] bg-night text-white flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Télécommande</p>
      <h1 data-testid="remote-status" className="text-2xl font-semibold tracking-tight">{m.title}</h1>
      <p className="max-w-xs text-sm text-white/60">{m.body}</p>
    </main>
  );
}
