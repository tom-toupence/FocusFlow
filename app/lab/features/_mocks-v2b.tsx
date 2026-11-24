// Vague 2 : maquettes statiques (suite).
import { SessionFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

/* Minuteur qui connaît ton agenda ------------------------------------------ */
export function Agenda() {
  const x = (h: number) => ((h - 13) / 5) * 100;
  return (
    <SessionFrame still="/rue/kanazawa/still.webp">
      <div className="absolute left-8 top-8">
        <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Study with me, Osaka</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">Abao in Tokyo</div>
      </div>
      <div className="absolute right-8 top-7 text-right">
        <div className="relative font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>16:20<Marker n={1} className="-left-9 top-3" /></div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Pomodoro 3 · raccourci à 19 min</div>
        <div className="mt-1 text-xs text-white/50">Réunion d&apos;équipe à 15:00. Tu finis à 14:55.</div>
      </div>
      <div className="absolute inset-x-8 bottom-28 rounded-xl border border-white/15 bg-black/60 p-5">
        <Marker n={2} className="-left-3 -top-3" />
        <Label>Ton après-midi, recalculé</Label>
        <div className="relative mt-6 h-16">
          {[13, 14, 15, 16, 17, 18].map((h) => <span key={h} className="absolute -top-5 font-mono text-[10px] text-white/40" style={{ left: `${x(h)}%` }}>{h}h</span>)}
          {[
            [13.5, 14.0, "25", false], [14.1, 14.5, "25", false], [14.6, 14.92, "19", true],
          ].map(([a, b, l, now]) => (
            <div key={String(a)} className="absolute top-0 h-12 rounded-md border px-2 py-1 font-mono text-[10px]" style={{ left: `${x(a as number)}%`, width: `${x(b as number) - x(a as number)}%`, borderColor: now ? SODIUM : "rgba(255,255,255,.2)", background: now ? "color-mix(in oklch, " + SODIUM + " 20%, transparent)" : "rgba(255,255,255,.05)" }}>{l as string}</div>
          ))}
          <div className="absolute top-0 h-12 rounded-md border border-dashed border-white/40 bg-white/10 px-2 py-1 text-[11px]" style={{ left: `${x(15)}%`, width: `${x(16) - x(15)}%` }}>Réunion</div>
          {[[16.05, 16.47], [16.55, 16.97], [17.05, 17.47]].map(([a, b]) => (
            <div key={a} className="absolute top-0 h-12 rounded-md border border-white/15 px-2 py-1 font-mono text-[10px] text-white/50" style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%` }}>25</div>
          ))}
          <div className="absolute -bottom-1 top-0 w-px" style={{ left: `${x(14.6)}%`, background: CYAN }} />
        </div>
        <div className="relative mt-3 text-xs text-white/55">
          <Marker n={3} className="-left-9 -top-1" />
          À 16:00, la session reprend toute seule là où elle en était (même titre, même tâche). Agenda lu depuis ton adresse iCal privée, jamais stockée sur un serveur.
        </div>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2"><Pill primary>Pause</Pill><Pill>Distraction</Pill><Pill>Suivant</Pill><Pill>Ignorer la réunion</Pill></div>
    </SessionFrame>
  );
}

/* Courrier de pause -------------------------------------------------------- */
export function Courrier() {
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[420px]">
        <Marker n={1} className="-left-3 -top-3" />
        <Card>
          <Label>Chez Léa, qui t&apos;écrit à 14:12</Label>
          <div className="mt-4 space-y-2">
            <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-sm text-black">tu as les slides de jeudi ?</div>
            <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-white/15 px-3 py-2 text-sm text-white/80">
              Tom est en focus. Ton message lui arrive à sa pause, vers <span className="font-mono">14:25</span>.
              <div className="mt-1 font-mono text-[10px] text-white/40">réponse automatique</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2"><Pill>C&apos;est urgent</Pill></div>
          <div className="mt-2 text-xs text-white/40">« Urgent » le fait passer tout de suite, 1 fois par jour.</div>
        </Card>
      </div>
      <div className="relative flex-1">
        <Marker n={2} className="-left-3 -top-3" />
        <div className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[url(/rue/hoian/still.webp)] bg-cover">
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute left-6 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Pause courte · 14:25</div>
          <div className="absolute right-6 top-4 font-mono text-5xl tabular-nums" style={{ color: SODIUM }}>04:58</div>
          <div className="absolute left-1/2 top-24 w-[440px] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/70 p-5">
            <Label>Pendant ton focus · 25 min</Label>
            {[["Léa", "tu as les slides de jeudi ?"], ["Sam", "Encouragement"], ["FocusFlow", "Succès débloqué : 10 h cette semaine"]].map(([w, m]) => (
              <div key={w} className="mt-3 flex items-center gap-3 text-sm"><span className="h-7 w-7 rounded-full" style={{ background: w === "FocusFlow" ? "#333" : CYAN }} /><span className="w-20 text-white/60">{w}</span><span className="flex-1 truncate">{m}</span></div>
            ))}
            <div className="mt-4 flex gap-2"><Pill primary>Répondre à Léa</Pill><Pill>Plus tard</Pill></div>
          </div>
          <div className="absolute bottom-5 left-6 flex items-center gap-2 text-xs text-white/55">
            <Marker n={3} className="!static" />
            Pendant le focus : aucun toast, aucun son, aucune pastille. Tout arrive ici, d&apos;un coup.
          </div>
        </div>
      </div>
    </div>
  );
}
