"use client";
// Interface côté ordinateur (lot 7) : le bouton de la rangée de la session, le
// panneau QR (Télécommande / Continuer sur le téléphone) et, côté téléphone qui
// vient de reprendre une session, l'écran « Toucher pour reprendre ».
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatHM } from "@/lib/stopPlan";
import type { RemoteHost } from "@/lib/remote/useRemoteHost";
import QrCode from "./QrCode";

// Mêmes classes que les boutons de la rangée de la session (Pill).
const PILL = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs transition-colors";
const PILL_IDLE = "border-white/15 bg-black/50 text-white/75 backdrop-blur-sm hover:bg-black/70 hover:text-white";
const PILL_ACTIVE = "border-white/30 bg-white/20 text-white backdrop-blur-sm";

export function RemoteButton({ remote }: { remote: RemoteHost }) {
  if (!remote.available) return null;
  return (
    <button
      type="button"
      onClick={() => remote.setOpen(!remote.open)}
      title={remote.connected ? "Télécommande · téléphone connecté" : "Télécommande"}
      aria-label="Télécommande"
      aria-pressed={remote.open}
      className={cn(PILL, "relative", remote.open ? PILL_ACTIVE : PILL_IDLE)}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M11 18h2" strokeLinecap="round" />
      </svg>
      {remote.connected && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-focus" />}
    </button>
  );
}

export function RemoteLayer({ remote }: { remote: RemoteHost }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <>
      {remote.open && remote.available && <RemotePanel remote={remote} />}
      {remote.ask && <AskCard remote={remote} />}
      {remote.gate?.visible && <ResumeGate gate={remote.gate} />}
    </>,
    document.body,
  );
}

function RemotePanel({ remote }: { remote: RemoteHost }) {
  const { tab, code, connected, handingOff } = remote;
  const url = tab === "remote" ? remote.remoteUrl : remote.handoffUrl;
  const status = handingOff
    ? "Transfert vers le téléphone…"
    : connected ? "Téléphone connecté" : code ? "En attente du téléphone" : "Télécommande déconnectée";

  return (
    <div
      role="dialog"
      aria-label="Télécommande"
      data-testid="remote-panel"
      className="fixed z-[110] inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-[4.5rem] md:w-[25rem] rounded-xl border border-white/10 bg-night/90 text-white backdrop-blur-sm shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-2">
        <div role="tablist" aria-label="Usage du téléphone" className="flex flex-1 gap-1">
          {(["remote", "handoff"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => remote.setTab(t)}
              className={cn(
                "h-8 flex-1 rounded-lg px-2 text-xs transition-colors",
                tab === t ? "bg-white/15 text-white" : "text-white/55 hover:text-white",
              )}
            >
              {t === "remote" ? "Télécommande" : "Continuer sur le téléphone"}
            </button>
          ))}
        </div>
        <button onClick={() => remote.setOpen(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 hover:text-white">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="flex gap-4 p-4">
        {url ? (
          <QrCode text={url} size={132} testId="remote-qr" label={tab === "remote" ? "QR code de la télécommande" : "QR code pour continuer sur le téléphone"} />
        ) : (
          <div className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-[11px] text-white/45">
            Aucun code
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Code</p>
          <p data-testid="remote-code" className="mt-1 font-mono text-[26px] leading-none tracking-[0.18em] tabular-nums">{code ?? "------"}</p>
          <p className="mt-2 text-[11px] leading-snug text-white/45">Le QR code contient une clé secrète : chaque téléphone doit ensuite être autorisé ici.</p>
          <p role="status" className="mt-3 flex items-center gap-2 text-xs text-white/75">
            <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", connected || handingOff ? "bg-focus" : "bg-white/30")} />
            {status}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-white/10 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-white/50">
          {tab === "remote"
            ? <>Scanne avec ton téléphone. Sans compte. Marche tant que l&apos;écran du téléphone est allumé.</>
            : <>Scanne pour continuer ici sur ton téléphone, au même temps restant. L&apos;ordinateur s&apos;arrête tout seul, rien n&apos;est compté deux fois.</>}
          {remote.expiresAt && <span className="block text-white/35">Code valable jusqu&apos;à {formatHM(remote.expiresAt)}.</span>}
        </p>
        {code && (
          <button
            onClick={remote.disconnect}
            className="h-8 shrink-0 rounded-lg border border-white/15 px-3 text-xs text-white/75 transition-colors hover:border-rose-400/50 hover:text-rose-300"
          >
            Déconnecter
          </button>
        )}
      </div>
    </div>
  );
}

/** Un téléphone a scanné le QR : rien ne se passe sans « Autoriser » ici. */
function AskCard({ remote }: { remote: RemoteHost }) {
  const handoff = remote.ask?.kind === "handoff";
  return (
    <div
      role="alertdialog"
      aria-label={handoff ? "Un téléphone demande la session" : "Un téléphone veut se connecter"}
      data-testid="remote-ask"
      className="fixed z-[115] left-1/2 top-20 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-white/15 bg-night/95 p-4 text-white backdrop-blur-sm shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
    >
      <p className="text-sm">{handoff ? "Un téléphone demande la session. Autoriser ?" : "Un téléphone veut se connecter. Autoriser ?"}</p>
      <p className="mt-1 text-[11px] text-white/50">
        {handoff ? "La session continuera sur le téléphone et s'arrêtera ici." : "Il pourra mettre en pause, noter une distraction et passer au titre suivant."}
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={remote.authorize} className="h-9 rounded-lg bg-white px-4 text-xs font-medium text-black hover:bg-white/90">Autoriser</button>
        <button onClick={remote.deny} className="h-9 rounded-lg border border-white/15 px-4 text-xs text-white/75 hover:text-white">Refuser</button>
      </div>
    </div>
  );
}

/** Téléphone : l'autoplay est bloqué (iOS), un toucher lance le son à la bonne seconde. */
function ResumeGate({ gate }: { gate: NonNullable<RemoteHost["gate"]> }) {
  // Lecteur jamais prêt (réseau, Spotify) : au bout de 6 s, le toucher ferme quand même l'écran.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const id = setTimeout(() => setWaited(true), 6000); return () => clearTimeout(id); }, []);
  const ready = gate.ready || waited;
  return (
    <button
      type="button"
      onClick={gate.resume}
      disabled={!ready}
      data-testid="resume-gate"
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-3 bg-night/90 px-8 text-center text-white backdrop-blur-sm"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Repris de l&apos;ordinateur</span>
      <span className="text-2xl font-semibold tracking-tight">{ready ? "Toucher pour reprendre" : "Chargement…"}</span>
      <span className="max-w-xs text-sm text-white/60">Le son repart à la bonne seconde. Le minuteur, lui, n&apos;a pas attendu.</span>
    </button>
  );
}
