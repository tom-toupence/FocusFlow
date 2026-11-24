"use client";
// La télécommande, côté téléphone (lot 7) : /remote#c=<code>&k=<secret>, sans compte.
// Demande l'appairage (« Autoriser ? » sur l'ordinateur), puis affiche le temps
// restant de l'ordinateur (calculé depuis son échéance, donc sans dérive) et
// envoie Pause/Reprendre, Distraction, Suivant. Messages signés (SecureChannel).
// Marche tant que l'écran du téléphone est allumé (Wake Lock demandé).
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/timerClock";
import { formatHM } from "@/lib/stopPlan";
import { SecureChannel } from "@/lib/remote/channel";
import { useLinkOnce } from "@/lib/remote/useLink";
import { deviceIdentity, deviceSigner, type DeviceIdentity } from "@/lib/remote/deviceKey";
import {
  displaySeconds, HOST_TIMEOUT_MS, newNonce, STATE_INTERVAL_MS,
  type RemoteCommand, type RemoteState,
} from "@/lib/remote/protocol";
import { useWakeLock } from "./useWakeLock";

type Status = "starting" | "connecting" | "waiting" | "live" | "lost" | "denied" | "expired" | "ended" | "handed" | "invalid" | "unavailable";

const MODE_LABEL: Record<RemoteState["mode"], string> = { work: "Focus", "short-break": "Pause courte", "long-break": "Longue pause" };
export default function RemoteClient() {
  const [status, setStatus] = useState<Status>("starting");
  const [code, setCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const readLink = useLinkOnce();
  const [state, setState] = useState<RemoteState | null>(null);
  const [offset, setOffset] = useState(0);
  const [skewed, setSkewed] = useState(false);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState(0);
  const channelRef = useRef<SecureChannel | null>(null);
  const deviceRef = useRef<DeviceIdentity | null>(null);
  useWakeLock(status === "live");

  useEffect(() => {
    const link = readLink();
    if (!link) { setStatus("invalid"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setCode(link.code);
    setStatus("connecting");
    // Défi du hello : l'horloge ne se cale que sur une réponse qui le renvoie.
    const challenge = newNonce();
    let alive = true;
    let finished = false;
    let paired = false;
    let lastHeard = Date.now();
    let cleanup = () => {};
    void Promise.all([SecureChannel.open(link.code, link.secret, { challenge }), deviceIdentity().catch(() => null)]).then(([ch, me]) => {
      if (!alive) { ch?.close(); return; }
      if (!ch || !me) { ch?.close(); setStatus("unavailable"); return; }
      channelRef.current = ch;
      deviceRef.current = me;
      setConfirm(me.code);
      const device = me.id;
      const hello = () => void ch.send({ type: "hello", role: "remote", id: device, pub: me.pub, ch: challenge });
      const unsub = ch.onMessage((m) => {
        if (finished) return;
        lastHeard = Date.now();
        setOffset(ch.offset ?? 0);
        setSkewed(ch.skewed);
        if (m.type === "wait" && m.id === device && !paired) setStatus("waiting");
        else if (m.type === "paired" && m.id === device) { paired = true; setStatus((s) => (s === "live" ? s : "connecting")); }
        else if (m.type === "refused" && m.id === device) { finished = true; setStatus("denied"); }
        else if (m.type === "state" && paired) {
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
        if (Date.now() - lastHeard > HOST_TIMEOUT_MS) setStatus("lost");
      }, STATE_INTERVAL_MS);
      const first = setTimeout(() => { if (!finished && Date.now() - lastHeard >= HOST_TIMEOUT_MS - 50) setStatus("lost"); }, HOST_TIMEOUT_MS);
      cleanup = () => { clearInterval(beat); clearTimeout(first); unsub(); ch.close(); channelRef.current = null; };
    });
    return () => { alive = false; cleanup(); };
  }, [readLink]);

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
    const me = deviceRef.current;
    if (me) void channelRef.current?.send({ type: "cmd", id: me.id, cmd, sig: "" }, deviceSigner(me));
    if (cmd === "distraction") setFlash((n) => n + 1);
  };

  if (shown !== "live") return <RemoteMessage status={shown} code={code} confirm={confirm} skewed={skewed} />;
  if (!state) return <RemoteMessage status="connecting" code={code} confirm={confirm} skewed={skewed} />;

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
        {skewed && <SkewNote />}
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/55">
          Sans compte. Code valable jusqu&apos;à {formatHM(state.expiresAt + offset)}. Marche tant que l&apos;écran du téléphone est allumé.
        </p>
      </div>
    </main>
  );
}

/** Code de confirmation : le même doit s'afficher sur l'ordinateur avant « Autoriser ». */
export function ConfirmCode({ code }: { code: string }) {
  return (
    <p data-testid="confirm-code" className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
      Code de confirmation : <span className="font-mono text-lg tracking-[0.2em] text-white">{code}</span>
    </p>
  );
}

function SkewNote() {
  return (
    <p data-testid="remote-skew" className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100/80">
      Horloge du téléphone décalée. Le temps affiché est corrigé sur celui de l&apos;ordinateur.
    </p>
  );
}

const MESSAGES: Record<Exclude<Status, "live">, { title: string; body: string }> = {
  starting: { title: "Télécommande", body: "" },
  connecting: { title: "Connexion à l'ordinateur…", body: "Garde la session ouverte sur l'ordinateur." },
  waiting: { title: "Autorise ce téléphone", body: "Vérifie que l'ordinateur affiche le même code, puis clique sur « Autoriser »." },
  lost: { title: "Ordinateur introuvable", body: "Vérifie que la session est ouverte sur l'ordinateur. On réessaie tout seul." },
  denied: { title: "Connexion refusée", body: "L'ordinateur a refusé ce téléphone." },
  expired: { title: "Code expiré", body: "Ouvre la télécommande sur l'ordinateur pour avoir un nouveau QR code." },
  ended: { title: "Télécommande déconnectée", body: "La session est terminée sur l'ordinateur, ou la télécommande a été coupée." },
  handed: { title: "Session transférée", body: "La session continue sur un téléphone." },
  invalid: { title: "Lien invalide", body: "Scanne à nouveau le QR code affiché sur l'ordinateur." },
  unavailable: { title: "Télécommande indisponible", body: "Ouvre ce lien en https, avec une version de FocusFlow qui a un canal pour la télécommande." },
};

function RemoteMessage({ status, code, confirm, skewed }: { status: Exclude<Status, "live">; code: string | null; confirm: string | null; skewed: boolean }) {
  const m = MESSAGES[status];
  return (
    <main className="min-h-[100dvh] bg-night text-white flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Télécommande{code ? ` · code ${code}` : ""}</p>
      <h1 data-testid="remote-status" className="text-2xl font-semibold tracking-tight">{m.title}</h1>
      {m.body && <p className="max-w-xs text-sm text-white/60">{m.body}</p>}
      {status === "waiting" && confirm && <ConfirmCode code={confirm} />}
      {skewed && <div className="max-w-xs"><SkewNote /></div>}
    </main>
  );
}
