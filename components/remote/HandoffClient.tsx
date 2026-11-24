"use client";
// « Emporter la session », côté téléphone (lot 7) : /handoff/<code>, sans compte.
// Rejoint le canal, reçoit l'état complet de l'ordinateur, hydrate les stores,
// envoie l'accusé de réception (l'ordinateur crédite alors son partiel et
// s'arrête), puis ouvre /session.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { toast } from "@/components/Toast";
import { openTransport } from "@/lib/remote/transport";
import { applyHandoff } from "@/lib/remote/handoffApply";
import { HOST_TIMEOUT_MS, makeMessage, newNonce, normalizeCode, ReplayGuard } from "@/lib/remote/protocol";

type Status = "connecting" | "lost" | "refused" | "expired" | "ended" | "invalid" | "unavailable" | "done";

/** Le téléphone redemande tant que rien n'arrive. */
const HELLO_EVERY_MS = 3000;

export default function HandoffClient({ rawCode }: { rawCode: string }) {
  const router = useRouter();
  const code = normalizeCode(rawCode);
  const hydrated = useTimerStore((s) => s.hydrated);
  const [status, setStatus] = useState<Status>(code ? "connecting" : "invalid");
  // Stable d'un rendu à l'autre (et entre les deux passages d'effet du mode strict) :
  // l'ordinateur reconnaît la même demande et ne la refuse pas.
  const [requestId] = useState(() => newNonce());
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!code || !hydrated || appliedRef.current) return;
    const t = openTransport(code);
    if (!t) { setStatus("unavailable"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const guard = new ReplayGuard();
    const startedAt = Date.now();
    let done = false;
    const hello = () => void t.send(makeMessage({ type: "hello", role: "handoff", id: requestId }));
    const unsub = t.onMessage(async (raw) => {
      const m = guard.accept(raw);
      if (!m || done) return;
      if (m.type === "handoff" && m.id === requestId && !appliedRef.current) {
        done = true;
        appliedRef.current = true;
        const offset = Date.now() - m.t;
        const notice = applyHandoff(m.state, offset, m.t);
        // L'accusé part AVANT de quitter la page (sinon l'ordinateur continue).
        await t.send(makeMessage({ type: "ack", id: requestId }));
        setStatus("done");
        if (notice) toast({ title: "Session reprise", description: notice, accent: "amber" });
        router.replace("/session");
      } else if (m.type === "refused" && m.id === requestId) {
        done = true;
        setStatus("refused");
      } else if (m.type === "bye") {
        done = true;
        setStatus(m.reason === "expired" ? "expired" : m.reason === "handed-off" ? "refused" : "ended");
      }
    });
    hello();
    const beat = setInterval(() => {
      if (done) return;
      hello();
      if (Date.now() - startedAt >= HOST_TIMEOUT_MS) setStatus("lost");
    }, HELLO_EVERY_MS);
    return () => { clearInterval(beat); unsub(); t.close(); };
  }, [code, hydrated, requestId, router]);

  const m = MESSAGES[status];
  return (
    <main className="min-h-[100dvh] bg-night text-white flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Continuer sur le téléphone</p>
      <h1 data-testid="handoff-status" className="text-2xl font-semibold tracking-tight">{m.title}</h1>
      <p className="max-w-xs text-sm text-white/60">{m.body}</p>
    </main>
  );
}

const MESSAGES: Record<Status, { title: string; body: string }> = {
  connecting: { title: "Récupération de la session…", body: "Garde la session ouverte sur l'ordinateur." },
  lost: { title: "Ordinateur introuvable", body: "Vérifie que la session est ouverte sur l'ordinateur et que le code est le bon. On réessaie tout seul." },
  refused: { title: "Code déjà utilisé", body: "Cette session a déjà été reprise sur un autre téléphone." },
  expired: { title: "Code expiré", body: "Ouvre le panneau sur l'ordinateur pour avoir un nouveau code." },
  ended: { title: "Session terminée", body: "La session n'est plus ouverte sur l'ordinateur." },
  invalid: { title: "Code invalide", body: "Le code fait 6 caractères. Scanne à nouveau le QR code de l'ordinateur." },
  unavailable: { title: "Indisponible", body: "Cette version de FocusFlow n'a pas de canal pour reprendre une session." },
  done: { title: "Session reprise", body: "Ouverture de la session…" },
};
