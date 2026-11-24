// Maquettes 1 à 5 (statiques, rien n'est branché).
import { SessionFrame, AppFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

function Timer({ t = "24:12", label = "Pomodoro 2", progress = 0.03 }: { t?: string; label?: string; progress?: number }) {
  return (
    <div className="absolute right-8 top-7 text-right">
      <div className="font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>{t}</div>
      <div className="mt-2 ml-auto h-px w-48 bg-white/15"><div className="h-px" style={{ width: `${progress * 100}%`, background: SODIUM }} /></div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</div>
    </div>
  );
}

function NowPlaying({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="absolute left-8 top-8">
      <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />{title}</div>
      <div className="mt-1 font-mono text-[11px] text-white/50">{sub}</div>
    </div>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2">{children}</div>;
}

/* 1. Pauses en musique ---------------------------------------------------- */
export function PausesEnMusique() {
  return (
    <SessionFrame still="/rue/sapa/still.webp">
      <div className="absolute left-8 top-8 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Pause courte</div>
      <div className="absolute right-8 top-7 font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>04:12</div>
      <Marker n={1} className="left-8 top-[150px]" />
      <div className="absolute left-16 top-[150px] w-[420px] rounded-xl border border-white/15 bg-black/60 p-5">
        <Label>Fin du focus</Label>
        <div className="mt-3 flex h-16 items-end gap-1">
          {Array.from({ length: 30 }, (_, i) => {
            const v = i < 18 ? 1 : i < 22 ? 1 - (i - 17) / 5 : i < 26 ? 0.25 : Math.min(1, 0.25 + (i - 25) / 4);
            return <span key={i} className="flex-1 rounded-sm" style={{ height: `${v * 100}%`, background: i < 22 ? CYAN : i < 26 ? SODIUM : CYAN, opacity: i >= 18 && i < 26 ? 0.6 : 1 }} />;
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-white/45"><span>focus</span><span>fondu 15 s</span><span>pause</span><span>reprise 3 s</span></div>
      </div>
      <Marker n={2} className="right-[330px] top-[300px]" />
      <div className="absolute right-8 top-[300px] w-[300px] overflow-hidden rounded-xl border border-white/15 bg-black/70">
        <div className="h-[168px] bg-[url(/rue/kanazawa/still.webp)] bg-cover" />
        <div className="p-3">
          <div className="text-sm">Ma playlist « Pauses » · 2 / 9</div>
          <div className="font-mono text-[10px] text-white/45">Lecteur visible (règle YouTube)</div>
        </div>
      </div>
      <Marker n={3} className="left-8 bottom-[120px]" />
      <div className="absolute bottom-[110px] left-16 w-[420px] rounded-xl border border-white/15 bg-black/60 p-4">
        <Label>Pendant les pauses</Label>
        <div className="mt-3 flex gap-2"><Pill>Silence</Pill><Pill>Même musique, plus bas</Pill><Pill active>Ma playlist</Pill></div>
        <div className="mt-3 text-xs text-white/50">Au prochain focus, la file reprend au même titre, à la même seconde.</div>
      </div>
      <Bar><Pill primary>Reprendre</Pill><Pill>Passer la pause</Pill><Pill>Terminer</Pill></Bar>
    </SessionFrame>
  );
}

/* 2. Reprendre là où tu t'es arrêté --------------------------------------- */
export function Reprise() {
  return (
        <SessionFrame>
          <NowPlaying title="Study with me in Tokyo, 3h" sub="Abao in Tokyo" />
          <Timer t="00:00" label="Fin de session" progress={1} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-[460px] rounded-2xl border border-white/15 bg-black/70 p-7">
              <Marker n={1} className="-left-3 -top-3" />
              <Label>Avant de partir</Label>
              <div className="mt-3 text-lg">Où en es-tu ?</div>
              <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                Il reste la section 3 du rapport. Commencer par les chiffres de mars.
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-white" />
              </div>
              <div className="mt-3 text-xs text-white/50">Vidéo arrêtée à 1:12:40, reprise au même endroit.</div>
              <div className="mt-5 flex justify-end gap-2"><Pill>Passer</Pill><Pill primary>Garder pour demain</Pill></div>
            </div>
          </div>
        </SessionFrame>
  );
}

export function RepriseDashboard() {
  return (
    <AppFrame title="Aujourd'hui">
      <Label>Aujourd&apos;hui</Label>
      <h1 className="mt-2 text-3xl font-semibold">Bonsoir</h1>
      <div className="relative mt-8 grid grid-cols-12 gap-6">
        <Marker n={2} className="-left-3 -top-3" />
        <Card className="col-span-7">
          <Label>Reprendre</Label>
          <div className="mt-4 flex gap-5">
            <div className="h-28 w-48 shrink-0 rounded-xl bg-[url(/rue/kanazawa/still.webp)] bg-cover" />
            <div>
              <div className="text-sm text-white/50">Hier, 22:40</div>
              <div className="mt-1 text-lg leading-snug">Il reste la section 3 du rapport. Commencer par les chiffres de mars.</div>
              <div className="mt-2 font-mono text-[11px] text-white/45">Study with me in Tokyo · reprise à 1:12:40 · Deep 50/10</div>
            </div>
          </div>
          <div className="mt-5 flex gap-2"><Pill primary>Reprendre</Pill><Pill>Autre chose</Pill></div>
        </Card>
        <Card className="col-span-5 opacity-50"><Label>Objectif</Label><div className="mt-6 h-24 w-24 rounded-full border-8 border-white/15" /></Card>
      </div>
    </AppFrame>
  );
}

/* 3. Radio commune -------------------------------------------------------- */
export function RadioCommune() {
  return (
    <AppFrame title="Écouter">
      <Label>Écouter</Label>
      <div className="mt-3 flex gap-2 text-sm">
        {["Radio", "Catalogue", "Découvrir", "Ma bibliothèque", "Spotify", "Twitch"].map((t) => (
          <span key={t} className={"rounded-lg px-3 py-1.5 " + (t === "Radio" ? "bg-white/15" : "text-white/50")}>{t}</span>
        ))}
      </div>
      <div className="relative mt-8 grid grid-cols-12 gap-6">
        <Card className="col-span-8">
          <Marker n={1} className="-left-3 -top-3" />
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /><Label>En direct · Radio FocusFlow</Label></div>
          <div className="mt-5 flex gap-6">
            <div className="h-36 w-64 shrink-0 rounded-xl bg-[url(/rue/dotonbori/still.webp)] bg-cover" />
            <div className="flex-1">
              <div className="text-xl">Kyoto drive, lofi</div>
              <div className="text-sm text-white/50">Abao Vision</div>
              <div className="mt-4 h-1 rounded bg-white/15"><div className="h-1 w-2/5 rounded" style={{ background: CYAN }} /></div>
              <div className="mt-1 flex justify-between font-mono text-[11px] text-white/45"><span>18:02</span><span>45:00</span></div>
              <div className="relative mt-4 text-sm text-white/70">3 amis écoutent en ce moment<Marker n={2} className="-left-9 -top-0.5" /></div>
              <div className="mt-2 flex -space-x-2">{["#5eead4", "#f0abfc", "#fcd34d"].map((c) => <span key={c} className="h-7 w-7 rounded-full border-2 border-[#0b0e13]" style={{ background: c }} />)}</div>
            </div>
          </div>
          <div className="mt-6 flex gap-2"><Pill primary>Rejoindre et lancer un focus</Pill><Pill>Écouter seulement</Pill></div>
        </Card>
        <Card className="col-span-4">
          <Marker n={3} className="-left-3 -top-3" />
          <Label>Programme</Label>
          {[["Maintenant", "Kyoto drive, lofi"], ["21:45", "Study with me, Osaka"], ["22:30", "Jeju, pluie de nuit"], ["23:15", "Hong Kong night walk"]].map(([h, t]) => (
            <div key={h} className="mt-4 flex gap-3 text-sm"><span className="w-20 font-mono text-[11px] text-white/45">{h}</span><span className={h === "Maintenant" ? "" : "text-white/60"}>{t}</span></div>
          ))}
          <div className="mt-5 text-xs text-white/40">Le même programme pour tout le monde, calculé à partir de l&apos;heure.</div>
        </Card>
      </div>
    </AppFrame>
  );
}

/* 4. Promesse aux amis ---------------------------------------------------- */
export function Promesse() {
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[560px]">
        <Marker n={1} className="-left-3 -top-3" />
        <Card>
          <Label>Promesse</Label>
          <div className="mt-3 text-lg">Ce soir, je fais</div>
          <div className="mt-3 flex items-center gap-3">
            {[2, 3, 4, 6].map((n) => <span key={n} className={"rounded-lg border px-4 py-2 font-mono " + (n === 3 ? "border-white bg-white text-black" : "border-white/15 text-white/70")}>{n}</span>)}
            <span className="text-white/60">pomodoros avant</span>
            <span className="rounded-lg border border-white/15 px-3 py-2 font-mono">23:00</span>
          </div>
          <div className="mt-5 text-sm text-white/60">Visible par</div>
          <div className="mt-2 flex gap-2">
            {["Léa", "Sam", "Inès"].map((n, i) => <span key={n} className={"rounded-lg border px-3 py-1.5 text-sm " + (i < 2 ? "border-white/40 bg-white/10" : "border-white/15 text-white/50")}>{n}</span>)}
          </div>
          <div className="mt-6 flex justify-end"><Pill primary>Promettre</Pill></div>
        </Card>
      </div>
      <div className="relative flex-1 space-y-4">
        <Marker n={2} className="-left-3 -top-3" />
        <Card>
          <div className="flex items-center justify-between"><div className="text-sm">Sam a promis 3 pomodoros avant 23:00</div><span className="font-mono text-xs text-white/50">21:10</span></div>
          <div className="mt-4 flex gap-2">{[1, 1, 0].map((d, i) => <span key={i} className="h-2 flex-1 rounded" style={{ background: d ? CYAN : "rgba(255,255,255,.12)" }} />)}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-white/50"><span>2 / 3 · en focus maintenant</span><Pill>Encourager</Pill></div>
        </Card>
        <div className="relative">
          <Marker n={3} className="-left-3 -top-3" />
          <Card>
            <div className="text-sm">Léa a tenu sa promesse : 4 pomodoros.</div>
            <div className="mt-1 text-xs text-white/50">Hier, 22:52 · 6 promesses tenues sur 7 ce mois-ci</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* 5. Revue du dimanche ---------------------------------------------------- */
export function Revue() {
  return (
    <AppFrame title="Organisation">
      <Label>Revue de la semaine · 2 / 3</Label>
      <div className="mt-2 flex gap-2">{[1, 1, 0].map((d, i) => <span key={i} className="h-1 w-24 rounded" style={{ background: d ? CYAN : "rgba(255,255,255,.12)" }} />)}</div>
      <h1 className="mt-6 text-2xl font-semibold">Ce qui n&apos;est pas fini</h1>
      <div className="mt-1 text-sm text-white/50">Pour chaque tâche : la garder, la reporter, ou l&apos;abandonner.</div>
      <div className="relative mt-6 space-y-3">
        <Marker n={1} className="-left-3 -top-3" />
        {[["Finir le rapport trimestriel", "3 / 5 pomodoros", "Semaine prochaine"], ["Réviser chapitre 4", "0 / 2", "Lundi"], ["Trier les mails pro", "1 / 1, jamais coché", "Abandonner"]].map(([t, p, c]) => (
          <div key={t} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <div><div>{t}</div><div className="font-mono text-[11px] text-white/45">{p}</div></div>
            <div className="flex gap-2">{["Lundi", "Semaine prochaine", "Abandonner"].map((o) => <Pill key={o} active={o === c}>{o}</Pill>)}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-8 grid grid-cols-3 gap-4">
        <Marker n={2} className="-left-3 -top-3" />
        <Card><Label>Cette semaine</Label><div className="mt-2 font-mono text-2xl tabular-nums">11 h 20</div><div className="text-xs text-white/50">+18 % vs semaine passée</div></Card>
        <Card><Label>Prévu vs fait</Label><div className="mt-2 font-mono text-2xl tabular-nums">9 / 12</div><div className="text-xs text-white/50">blocs du planning</div></Card>
        <Card><Label>Étape suivante</Label><div className="mt-2 text-sm">Placer tes blocs de la semaine prochaine</div></Card>
      </div>
      <div className="mt-8 flex justify-end gap-2"><Pill>Retour</Pill><Pill primary>Continuer</Pill></div>
    </AppFrame>
  );
}
