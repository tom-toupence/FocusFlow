// Maquettes ajoutées après l'arbitrage product-lead (statiques).
import { AppFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

/* Tes titres qui marchent -------------------------------------------------- */
export function TitresQuiMarchent() {
  const rows: [string, string, number, number][] = [
    ["Nujabes - Aruarian Dance", "11 sessions", 0.2, 0.92],
    ["Kyoto drive, lofi", "8 sessions", 0.4, 0.85],
    ["Joe Hisaishi - Summer (piano)", "6 sessions", 0.5, 0.8],
    ["Study with me, Osaka", "9 sessions", 0.6, 0.76],
  ];
  return (
    <AppFrame title="Activité">
      <Label>Activité · Statistiques</Label>
      <h1 className="mt-2 text-2xl font-semibold">Ta musique de concentration</h1>
      <div className="mt-1 text-sm text-white/50">Calculé sur tes 46 dernières sessions, sur cet appareil.</div>
      <div className="relative mt-8 grid grid-cols-12 gap-6">
        <Card className="col-span-8">
          <Marker n={1} className="-left-3 -top-3" />
          <Label>Semblent t&apos;aider</Label>
          <div className="mt-4 space-y-4">
            {rows.map(([t, s, d, w]) => (
              <div key={t} className="flex items-center gap-4">
                <div className="h-10 w-16 shrink-0 rounded-md bg-[url(/rue/kanazawa/still.webp)] bg-cover" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{t}</div><div className="font-mono text-[10px] text-white/45">{s} · {d} distraction / pomodoro</div></div>
                <div className="h-1.5 w-40 rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${w * 100}%`, background: CYAN }} /></div>
              </div>
            ))}
          </div>
          <div className="relative mt-6 flex gap-2">
            <Marker n={2} className="-left-3 -top-3" />
            <Pill primary>Créer la playlist</Pill><Pill>Lancer une session avec</Pill>
          </div>
        </Card>
        <div className="col-span-4 space-y-6">
          <Card>
            <Label>En résumé</Label>
            <div className="mt-3 text-sm">Avec ces titres, tu notes <span className="font-mono" style={{ color: SODIUM }}>40 %</span> de distractions en moins.</div>
          </Card>
          <Card className="relative">
            <Marker n={3} className="-left-3 -top-3" />
            <Label>Te dispersent peut-être</Label>
            <div className="mt-3 text-sm text-white/70">City pop mix, 1h</div>
            <div className="font-mono text-[10px] text-white/45">4 sessions · 2,1 distractions / pomodoro</div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}

/* Go sur tous les blocs ---------------------------------------------------- */
export function GoBlocs() {
  const blocks = [
    { s: 9, d: 1.5, l: "Rapport", done: true },
    { s: 14, d: 0.85, l: "Rédaction", now: true },
    { s: 16.5, d: 1, l: "Révisions" },
  ];
  const x = (h: number) => ((h - 8) / 14) * 100;
  return (
    <AppFrame title="Aujourd'hui">
      <Label>Aujourd&apos;hui</Label>
      <h1 className="mt-2 text-3xl font-semibold">Bon après-midi</h1>
      <div className="relative mt-8">
        <Marker n={1} className="-left-3 -top-3" />
        <Card>
          <Label>Ta journée</Label>
          <div className="relative mt-8 h-20">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
            {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => <span key={h} className="absolute -top-6 font-mono text-[10px] text-white/35" style={{ left: `${x(h)}%` }}>{h}h</span>)}
            {blocks.map((b) => (
              <div key={b.l} className="absolute top-2 h-16 rounded-lg border px-3 py-2 text-xs"
                style={{ left: `${x(b.s)}%`, width: `${(b.d / 14) * 100}%`, borderColor: b.now ? CYAN : "rgba(255,255,255,.15)", background: b.now ? "color-mix(in oklch, " + CYAN + " 18%, transparent)" : "rgba(255,255,255,.04)", opacity: b.done ? 0.5 : 1 }}>
                <div className="truncate">{b.l}</div>
                <div className="mt-1 font-mono text-[10px] text-white/50">{b.done ? "fait" : b.now ? "Go" : "Go"}</div>
              </div>
            ))}
            <div className="absolute -bottom-2 top-0 w-px" style={{ left: `${x(14)}%`, background: SODIUM }} />
          </div>
        </Card>
      </div>
      <div className="absolute bottom-8 right-8 w-[380px] rounded-xl border border-white/15 bg-[#11151c] p-5 shadow-2xl">
        <Marker n={2} className="-left-3 -top-3" />
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} /><Label>14:00 · Bloc prévu</Label></div>
        <div className="mt-2 text-lg">Rédaction commence</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">50 min · Deep · Study with me, Osaka (ton dernier média)</div>
        <div className="mt-4 flex gap-2"><Pill primary>Démarrer</Pill><Pill>Dans 10 min</Pill><Pill>Pas aujourd&apos;hui</Pill></div>
      </div>
    </AppFrame>
  );
}
