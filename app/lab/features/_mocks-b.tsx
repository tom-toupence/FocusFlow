// Maquettes 6 à 10 (statiques, rien n'est branché).
import { Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";


/* 7. Écran verrouillé ----------------------------------------------------- */
export function EcranVerrouille() {
  return (
    <div className="flex w-[1280px] items-center justify-center gap-16 bg-[#07090d] py-10 text-white">
      <div className="relative h-[640px] w-[300px] overflow-hidden rounded-[44px] border-[10px] border-neutral-800 bg-cover bg-center" style={{ backgroundImage: "url(/rue/gion-nuit/still.webp)" }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative pt-14 text-center">
          <div className="text-sm text-white/80">mardi 24 novembre</div>
          <div className="text-7xl font-light tabular-nums">21:47</div>
        </div>
        <Marker n={1} className="left-3 top-[230px]" />
        <div className="relative mx-3 mt-12 rounded-3xl bg-black/55 p-4 backdrop-blur">
          <div className="flex gap-3">
            <div className="h-14 w-14 shrink-0 rounded-lg bg-[url(/rue/kanazawa/still.webp)] bg-cover" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Focus · 18:42 restantes</div>
              <div className="truncate text-xs text-white/60">Nujabes - Aruarian Dance</div>
              <div className="text-[10px] text-white/40">FocusFlow</div>
            </div>
          </div>
          <div className="mt-3 h-1 rounded bg-white/20"><div className="h-1 w-1/4 rounded" style={{ background: SODIUM }} /></div>
          <div className="mt-3 flex justify-around text-white/90">
            <span>|◀</span><span className="text-xl">❙❙</span><span>▶|</span>
          </div>
        </div>
      </div>
      <div className="w-[460px] space-y-5 text-sm text-white/70">
        <div className="text-lg text-white">Le minuteur, sans revenir sur l&apos;onglet</div>
        <div className="relative">
          <Marker n={2} className="-left-3 -top-3" />
          <div className="overflow-hidden rounded-lg border border-white/15">
          <div className="flex gap-1 bg-neutral-900 px-2 pt-2">
            <span className="rounded-t-md bg-neutral-800 px-3 py-1.5 font-mono text-xs text-white">18:42 · Focus</span>
            <span className="rounded-t-md px-3 py-1.5 text-xs text-white/40">Docs - Rapport</span>
            <span className="rounded-t-md px-3 py-1.5 text-xs text-white/40">Mail</span>
          </div>
          <div className="h-10 bg-neutral-800" />
          </div>
        </div>
        <p><span className="text-white">1.</span> Sur l&apos;écran verrouillé et dans les contrôles média de l&apos;ordinateur : temps restant, titre et miniature.</p>
        <p><span className="text-white">2.</span> Le titre de l&apos;onglet affiche le temps restant.</p>
        <p className="relative"><span className="text-white">3.</span> Touche lecture/pause du clavier : musique ET minuteur. Touche suivant : titre suivant.<Marker n={3} className="-left-9 top-0" /></p>
        <p className="text-white/45">En pause : « Pause · 04:12 ».</p>
      </div>
    </div>
  );
}

/* 8. Série à deux --------------------------------------------------------- */
export function SerieADeux() {
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[340px] rounded-2xl border border-white/10 bg-[#0d1117] p-5">
        <Marker n={1} className="-left-3 -top-3" />
        <Label>Amis</Label>
        {[["Léa", "En focus · lofi Kyoto", 23, true], ["Sam", "En ligne", 6, false], ["Inès", "Hors ligne", 0, false]].map(([n, s, k, f]) => (
          <div key={n as string} className="mt-4 flex items-center gap-3">
            <span className="h-9 w-9 rounded-full" style={{ background: f ? CYAN : "#555" }} />
            <div className="flex-1"><div className="text-sm">{n}</div><div className="text-xs text-white/50">{s}</div></div>
            {(k as number) > 0 && <span className="rounded-md border border-white/15 px-2 py-0.5 font-mono text-xs" style={{ color: SODIUM }}>{k as number} j</span>}
          </div>
        ))}
      </div>
      <div className="relative flex-1">
        <Marker n={2} className="-left-3 -top-3" />
        <Card>
          <Label>Série avec Léa</Label>
          <div className="mt-3 flex items-baseline gap-3"><span className="font-mono text-5xl tabular-nums" style={{ color: SODIUM }}>23</span><span className="text-white/60">jours d&apos;affilée, tous les deux</span></div>
          <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs text-white/50">
            {days.map((d, i) => (
              <div key={i}>
                <div className="mb-2">{d}</div>
                <div className="flex justify-center gap-1">
                  <span className="h-6 w-3 rounded-sm" style={{ background: i < 6 ? CYAN : "rgba(255,255,255,.12)" }} />
                  <span className="h-6 w-3 rounded-sm" style={{ background: i < 5 ? CYAN : "rgba(255,255,255,.12)" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="relative mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <Marker n={3} className="-left-3 -top-3" />
            Aujourd&apos;hui : Léa a fait son pomodoro, pas toi. Il reste <span className="font-mono">2 h 13</span>.
            <div className="mt-3 flex gap-2"><Pill primary>Lancer un focus</Pill><Pill>Rappelle-moi à 22:00</Pill></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* 9. Lien de session ------------------------------------------------------ */
export function LienSession() {
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[520px]">
        <Marker n={1} className="-left-3 -top-3" />
        <Card>
          <div className="flex gap-2 text-xs">{["Session", "Playlist", "Routine"].map((t) => <span key={t} className={"rounded-lg px-3 py-1.5 " + (t === "Session" ? "bg-white/15" : "text-white/50")}>{t}</span>)}</div>
          <div className="mt-4"><Label>Partager par lien</Label></div>
          <div className="mt-4 flex gap-4">
            <div className="h-24 w-40 shrink-0 rounded-xl bg-[url(/rue/hoian-nuit/still.webp)] bg-cover" />
            <div className="text-sm"><div>Study with me, Osaka</div><div className="font-mono text-[11px] text-white/50">Deep 50 / 10 · 4 cycles</div></div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            {[["Ambiance et rythme", true], ["Mes tâches", false], ["Démarrer automatiquement", true]].map(([l, on]) => (
              <label key={l as string} className="flex items-center justify-between"><span className="text-white/80">{l}</span>
                <span className="h-4 w-8 rounded-full p-0.5" style={{ background: on ? CYAN : "rgba(255,255,255,.2)" }}><span className={"block h-3 w-3 rounded-full bg-black " + (on ? "translate-x-4" : "")} /></span>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white/70">
            focusflow.app/import#v1.s.Osk3.d50<span className="ml-auto text-white">Copier</span>
          </div>
        </Card>
      </div>
      <div className="relative flex-1">
        <Marker n={2} className="-left-3 -top-3" />
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-white/50"><span className="h-2 w-2 rounded-full bg-white/20" />focusflow.app/import#v1.s.Osk3.d50</div>
          <div className="relative flex h-[380px] items-center justify-center bg-[url(/rue/hoian-nuit/still.webp)] bg-cover">
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative text-center">
              <div className="text-sm text-white/60">Tom t&apos;invite à travailler sur</div>
              <div className="mt-1 text-2xl">Study with me, Osaka</div>
              <div className="mt-1 font-mono text-xs text-white/50">Deep 50 / 10 · 4 cycles · sans compte</div>
              <div className="mt-6 inline-flex gap-2"><Pill primary>Commencer</Pill><Pill>Ajouter à ma bibliothèque</Pill></div>
              <div className="mt-4 text-xs text-white/40">Tout est dans le lien. Rien ne passe par un serveur.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

