"use client";

// Profil, section « Agenda » : l'adresse iCal privée (stockée dans ce
// navigateur uniquement), un test qui montre les prochains événements
// occupés d'aujourd'hui, et de quoi la retirer.
import { useState } from "react";
import { usePrefsStore } from "@/store/prefsStore";
import { useAgendaStore } from "@/store/agendaStore";
import { normalizeIcalUrl } from "@/lib/icalUrl";
import { eventLabel } from "@/lib/agendaTimer";
import { formatHM } from "@/lib/stopPlan";
import type { BusyEvent } from "@/lib/agendaFit";
import { cn } from "@/lib/utils";

const SHOWN = 5;

/** Événements occupés restants aujourd'hui (en cours compris). */
function todayEvents(events: BusyEvent[], now: number): BusyEvent[] {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return events.filter((e) => e.end > now && e.start < midnight.getTime());
}

/** « calendar.google.com/… » : on ne réaffiche jamais l'adresse complète. */
function masked(url: string): string {
  try {
    return `${new URL(url).hostname}/…`;
  } catch {
    return "Adresse enregistrée";
  }
}

export default function AgendaSettings() {
  const icalUrl = usePrefsStore((s) => s.icalUrl);
  const setIcalUrl = usePrefsStore((s) => s.setIcalUrl);
  const status = useAgendaStore((s) => s.status);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<BusyEvent[] | null>(null);
  const loading = status === "loading";

  const test = async () => {
    setMessage(null);
    setShown(null);
    const target = icalUrl ?? draft;
    const n = normalizeIcalUrl(target);
    if (!n.ok) {
      setMessage({ ok: false, text: n.error });
      return;
    }
    const r = await useAgendaStore.getState().refresh(n.url);
    if (!r) return;
    if (!r.ok) {
      setMessage({ ok: false, text: r.error });
      return;
    }
    if (!icalUrl) {
      setIcalUrl(n.url);
      setDraft("");
    }
    const today = todayEvents(r.events, Date.now());
    setShown(today.slice(0, SHOWN));
    setMessage({
      ok: true,
      text: today.length === 0
        ? "Agenda lu. Aucun événement occupé aujourd'hui."
        : `Agenda lu. ${today.length} événement${today.length > 1 ? "s" : ""} occupé${today.length > 1 ? "s" : ""} aujourd'hui.`,
    });
  };

  const remove = () => {
    setIcalUrl(null);
    useAgendaStore.getState().clear();
    setDraft("");
    setShown(null);
    setMessage({ ok: true, text: "Adresse retirée." });
  };

  return (
    <div className="p-3 pt-0 space-y-2" data-testid="agenda-settings">
      <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider px-1">Agenda</p>
      <div className="rounded-xl p-3 bg-foreground/[0.03] border border-foreground/[0.06] space-y-2.5">
        <p className="text-[11px] text-foreground/45 leading-relaxed">
          Le pomodoro se raccourcit pour finir avant ta prochaine réunion.
        </p>

        {icalUrl ? (
          <p className="text-xs text-foreground/75 truncate" data-testid="agenda-saved">
            {masked(icalUrl)}
          </p>
        ) : (
          <label className="block">
            <span className="block text-[11px] text-foreground/60 mb-1">Adresse iCal privée</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") test(); }}
              placeholder="https://… ou webcal://…"
              maxLength={2048}
              className="w-full text-xs bg-foreground/[0.06] border border-foreground/15 rounded-lg px-2 py-1.5 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40"
            />
          </label>
        )}

        <div className="flex gap-2">
          <button
            onClick={test}
            disabled={loading || (!icalUrl && !draft.trim())}
            className="flex-1 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/70 hover:text-foreground text-xs font-medium transition-all disabled:opacity-40"
          >
            {loading ? "Lecture…" : "Tester"}
          </button>
          {icalUrl && (
            <button
              onClick={remove}
              className="flex-1 py-1.5 rounded-lg border border-foreground/[0.08] text-foreground/45 hover:text-red-400 hover:border-red-400/30 text-xs transition-all"
            >
              Retirer
            </button>
          )}
        </div>

        {message && (
          <p role="status" className={cn("text-[11px] leading-relaxed", message.ok ? "text-foreground/60" : "text-red-400")}>
            {message.text}
          </p>
        )}
        {shown && shown.length > 0 && (
          <ul className="space-y-1" data-testid="agenda-events">
            {shown.map((e) => (
              <li key={`${e.start}-${e.end}`} className="flex gap-2 text-[11px] text-foreground/70">
                <span className="font-mono tabular-nums text-foreground/45 shrink-0">{formatHM(e.start)} à {formatHM(e.end)}</span>
                <span className="truncate">{eventLabel(e)}</span>
              </li>
            ))}
          </ul>
        )}

        <details className="text-[11px] text-foreground/45 leading-relaxed">
          <summary className="cursor-pointer text-foreground/55 hover:text-foreground/80">Où trouver l&apos;adresse</summary>
          <ul className="mt-1.5 space-y-1">
            <li><span className="text-foreground/65">Google Agenda :</span> paramètres de l&apos;agenda, « Adresse secrète au format iCal ».</li>
            <li><span className="text-foreground/65">Apple Calendrier :</span> partager l&apos;agenda en public, puis copier le lien webcal.</li>
            <li><span className="text-foreground/65">Outlook :</span> paramètres, Calendriers partagés, publier un calendrier, lien ICS.</li>
          </ul>
        </details>
        <p className="text-[10px] text-foreground/35 leading-relaxed">
          L&apos;adresse reste dans ce navigateur. Elle passe par notre serveur pour lire l&apos;agenda, sans y être enregistrée.
          Sans effet en Flowtime et quand le minuteur est calé sur la vidéo.
        </p>
      </div>
    </div>
  );
}
