"use client";
// « Emporter la session », côté téléphone (lot 7) : /handoff#c=<code>&k=<secret>,
// sans compte. Demande la session (« Autoriser ? » sur l'ordinateur), reçoit
// l'état figé avec un nonce d'accusé, renvoie l'accusé toutes les 1,5 s, et
// n'hydrate ses stores puis n'ouvre /session qu'après le « bye handed-off » de
// l'ordinateur (qui a alors crédité son partiel et s'est arrêté). Sans ce bye
// sous 10 s : « Transfert incertain ».
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { toast } from "@/components/Toast";
import { SecureChannel } from "@/lib/remote/channel";
import { parseLink } from "@/lib/remote/crypto";
import { applyHandoff } from "@/lib/remote/handoffApply";
import { HANDOFF_ACK_TIMEOUT_MS, HOST_TIMEOUT_MS, newNonce, type HandoffState } from "@/lib/remote/protocol";

type Status = "starting" | "connecting" | "waiting" | "transferring" | "uncertain" | "lost" | "denied" | "taken" | "changed"
  | "expired" | "ended" | "invalid" | "unavailable" | "done";

/** Le téléphone redemande tant que rien n'arrive. */
const HELLO_EVERY_MS = 3000;
/** Accusé renvoyé jusqu'au « bye » de l'ordinateur. */
const ACK_EVERY_MS = 1500;

export default function HandoffClient() {
  const router = useRouter();
  const hydrated = useTimerStore((s) => s.hydrated);
  const [status, setStatus] = useState<Status>("starting");
  const [code, setCode] = useState<string | null>(null);
  // Stable d'un rendu à l'autre (et entre les deux passages d'effet du mode strict) :
  // l'ordinateur reconnaît la même demande.
  const [requestId] = useState(() => newNonce());
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || appliedRef.current) return;
    const link = parseLink(window.location.hash);
    if (!link) { setStatus("invalid"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setCode(link.code);
    setStatus((s) => (s === "starting" ? "connecting" : s));
    let alive = true;
    let cleanup = () => {};
    void SecureChannel.open(link.code, link.secret, "phone").then((ch) => {
      if (!alive) { ch?.close(); return; }
      if (!ch) { setStatus("unavailable"); return; }
      const startedAt = Date.now();
      let heard = false;
      let done = false;
      let received: { state: HandoffState; t: number; ack: string } | null = null;
      let ackTimer: ReturnType<typeof setInterval> | null = null;
      let ackDeadline: ReturnType<typeof setTimeout> | null = null;
      const stopAck = () => { if (ackTimer) clearInterval(ackTimer); if (ackDeadline) clearTimeout(ackDeadline); };
      const hello = () => void ch.send({ type: "hello", role: "handoff", id: requestId });
      const unsub = ch.onMessage((m) => {
        if (done) return;
        heard = true;
        if (m.type === "wait" && m.id === requestId && !received) setStatus("waiting");
        else if (m.type === "handoff" && m.id === requestId && !received) {
          received = { state: m.state, t: m.t, ack: m.ack };
          setStatus("transferring");
          const ack = () => void ch.send({ type: "ack", id: requestId, ack: m.ack });
          ack();
          ackTimer = setInterval(ack, ACK_EVERY_MS);
          ackDeadline = setTimeout(() => { if (!done) { done = true; stopAck(); setStatus("uncertain"); } }, HANDOFF_ACK_TIMEOUT_MS);
        } else if (m.type === "refused" && m.id === requestId) {
          done = true;
          stopAck();
          setStatus(m.reason === "denied" ? "denied" : m.reason === "changed" ? "changed" : "taken");
        } else if (m.type === "bye") {
          done = true;
          stopAck();
          if (m.reason === "handed-off" && received && !appliedRef.current) {
            // L'ordinateur s'est arrêté : la session est maintenant ici.
            appliedRef.current = true;
            const notice = applyHandoff(received.state, ch.offset ?? 0, received.t);
            setStatus("done");
            if (notice) toast({ title: "Session reprise", description: notice, accent: "amber" });
            router.replace("/session");
          } else {
            setStatus(m.reason === "expired" ? "expired" : m.reason === "handed-off" ? "taken" : "ended");
          }
        }
      });
      hello();
      const beat = setInterval(() => {
        if (done || received) return;
        hello();
        if (!heard && Date.now() - startedAt >= HOST_TIMEOUT_MS) setStatus("lost");
      }, HELLO_EVERY_MS);
      cleanup = () => { clearInterval(beat); stopAck(); unsub(); ch.close(); };
    });
    return () => { alive = false; cleanup(); };
  }, [hydrated, requestId, router]);

  const m = MESSAGES[status];
  return (
    <main className="min-h-[100dvh] bg-night text-white flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Continuer sur le téléphone{code ? ` · code ${code}` : ""}</p>
      <h1 data-testid="handoff-status" className="text-2xl font-semibold tracking-tight">{m.title}</h1>
      {m.body && <p className="max-w-xs text-sm text-white/60">{m.body}</p>}
    </main>
  );
}

const MESSAGES: Record<Status, { title: string; body: string }> = {
  starting: { title: "Continuer sur le téléphone", body: "" },
  connecting: { title: "Récupération de la session…", body: "Garde la session ouverte sur l'ordinateur." },
  waiting: { title: "Autorise sur l'ordinateur", body: "Clique sur « Autoriser » sur l'ordinateur pour reprendre la session ici." },
  transferring: { title: "Transfert de la session…", body: "L'ordinateur compte son temps et s'arrête." },
  uncertain: { title: "Transfert incertain", body: "Vérifie l'ordinateur : si la session y tourne encore, elle n'a pas été transférée." },
  lost: { title: "Ordinateur introuvable", body: "Vérifie que la session est ouverte sur l'ordinateur. On réessaie tout seul." },
  denied: { title: "Reprise refusée", body: "L'ordinateur a refusé de transférer la session." },
  taken: { title: "Code déjà utilisé", body: "Cette session a déjà été reprise sur un autre téléphone." },
  changed: { title: "La session a changé", body: "Le cycle a changé sur l'ordinateur pendant le transfert. Scanne à nouveau le QR code." },
  expired: { title: "Code expiré", body: "Ouvre le panneau sur l'ordinateur pour avoir un nouveau QR code." },
  ended: { title: "Session terminée", body: "La session n'est plus ouverte sur l'ordinateur." },
  invalid: { title: "Lien invalide", body: "Scanne à nouveau le QR code affiché sur l'ordinateur." },
  unavailable: { title: "Indisponible", body: "Ouvre ce lien en https, avec une version de FocusFlow qui a un canal pour reprendre une session." },
  done: { title: "Session reprise", body: "Ouverture de la session…" },
};
