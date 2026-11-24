// Vague 2 : maquettes statiques (après revue product-lead).
import { SessionFrame, AppFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

/* Calé sur la vidéo -------------------------------------------------------- */
export function CaleVideo() {
  const segs: [number, number, "w" | "b"][] = [[0, 50, "w"], [50, 60, "b"], [60, 110, "w"], [110, 120, "b"], [120, 170, "w"], [170, 180, "b"]];
  const x = (m: number) => (m / 180) * 100;
  return (
    <SessionFrame still="/rue/sannenzaka/still.webp">
      <div className="absolute left-8 top-8">
        <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Study with me in Tokyo, 3 h (50/10)</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">Abao in Tokyo</div>
      </div>
      {/* minuteur incrusté par le créateur dans la vidéo */}
      <div className="absolute left-[38%] top-[40%] rounded-md bg-black/50 px-3 py-1.5 font-mono text-2xl text-white/90">
        <Marker n={1} className="-left-9 top-1" />
        31:08 <span className="text-sm text-white/60">focus</span>
      </div>
      <div className="absolute right-8 top-7 text-right">
        <div className="relative font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>31:08<Marker n={2} className="-left-9 top-3" /></div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Calé sur la vidéo · bloc 1 / 3</div>
      </div>
      <div className="absolute inset-x-8 bottom-28 rounded-xl border border-white/15 bg-black/60 p-5">
        <Marker n={3} className="-left-3 -top-3" />
        <Label>Le rythme de la vidéo devient le tien</Label>
        <div className="relative mt-4 h-8">
          {segs.map(([a, b, k]) => (
            <div key={a} className="absolute top-0 flex h-8 items-center justify-center rounded font-mono text-[10px]"
              style={{ left: `${x(a)}%`, width: `calc(${x(b) - x(a)}% - 3px)`, background: k === "w" ? "rgba(255,255,255,.08)" : "color-mix(in oklch, " + CYAN + " 30%, transparent)" }}>
              {k === "w" ? "focus 50" : "pause 10"}
            </div>
          ))}
          <div className="absolute -bottom-1 -top-1 w-0.5" style={{ left: `${x(18.9)}%`, background: SODIUM }} />
        </div>
        <div className="mt-3 text-xs text-white/55">Tu arrives à 21:40 au milieu du bloc ? La vidéo saute au début du bloc suivant ou tu le prends en route. La cloche du créateur sonne en même temps que la tienne.</div>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2"><Pill primary>Pause</Pill><Pill>Distraction</Pill><Pill active>Calé sur la vidéo</Pill><Pill>Tâches</Pill></div>
    </SessionFrame>
  );
}

/* Dernier train ------------------------------------------------------------ */
export function DernierTrain() {
  const x = (h: number) => ((h - 14) / 5) * 100;
  return (
    <AppFrame title="Aujourd'hui">
      <Label>Avant de démarrer</Label>
      <h1 className="mt-2 text-2xl font-semibold">Tu t&apos;arrêtes à quelle heure ?</h1>
      <div className="relative mt-6 flex items-center gap-3">
        <Marker n={1} className="-left-3 -top-3" />
        {["17:00", "18:00", "18:30", "19:00"].map((h) => <span key={h} className={"rounded-lg border px-4 py-2 font-mono " + (h === "18:30" ? "border-white bg-white text-black" : "border-white/15 text-white/70")}>{h}</span>)}
        <span className="text-sm text-white/45">ou « pas d&apos;heure »</span>
      </div>
      <div className="relative mt-10">
        <Marker n={2} className="-left-3 -top-3" />
        <Card>
          <Label>Il est 14:20. Jusqu&apos;à 18:30 :</Label>
          <div className="relative mt-8 h-14">
            {[14, 15, 16, 17, 18, 19].map((h) => <span key={h} className="absolute -top-6 font-mono text-[10px] text-white/35" style={{ left: `${x(h)}%` }}>{h}h</span>)}
            {[[14.33, 14.75, 25], [14.83, 15.25, 25], [15.33, 15.75, 25], [15.83, 16.25, 25], [16.5, 16.92, 25], [17.0, 17.42, 25], [17.5, 17.92, 25], [18.0, 18.5, 30]].map(([a, b, l], i) => (
              <div key={a} className="absolute top-0 flex h-12 items-center justify-center rounded-md border font-mono text-[10px]"
                style={{ left: `${x(a)}%`, width: `calc(${x(b) - x(a)}% - 2px)`, borderColor: i === 7 ? SODIUM : "rgba(255,255,255,.18)", background: i === 7 ? "color-mix(in oklch, " + SODIUM + " 18%, transparent)" : "rgba(255,255,255,.05)" }}>{l}</div>
            ))}
            <div className="absolute -bottom-1 top-0 w-0.5 bg-white" style={{ left: `${x(18.5)}%` }} />
          </div>
          <div className="mt-4 text-sm text-white/70">8 pomodoros possibles. Le dernier dure 30 min pour finir pile à 18:30, et la longue pause de 16:15 est raccourcie.</div>
          <div className="relative mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <Marker n={3} className="-left-3 -top-3" />
            Objectif du jour : 10. <span className="text-white/60">Atteignable si tu t&apos;arrêtes à 19:30.</span>
          </div>
          <div className="mt-5 flex gap-2"><Pill primary>Démarrer</Pill><Pill>Classique, sans heure</Pill></div>
        </Card>
      </div>
    </AppFrame>
  );
}

/* Estimer par comparaison -------------------------------------------------- */
export function Comparaison() {
  const done: [string, number][] = [["Relire l'article", 1], ["Slides client", 2.5], ["Exercices chap. 3", 4], ["Rapport T2", 6]];
  return (
    <div className="w-[1280px] bg-[#07090d] p-10 text-white">
      <div className="relative mx-auto w-[900px]">
        <Card>
          <Label>Nouvelle tâche</Label>
          <div className="mt-2 text-xl">Préparer l&apos;oral de jeudi</div>
          <div className="mt-6 text-sm text-white/60">Glisse-la entre deux tâches que tu as déjà faites.</div>
          <div className="relative mt-10 h-28">
            <Marker n={1} className="-left-3 top-6" />
            <div className="absolute inset-x-0 top-10 h-px bg-white/15" />
            {done.map(([t, p]) => (
              <div key={t} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${(p / 6.5) * 100}%` }}>
                <div className="mx-auto h-5 w-px bg-white/40" />
                <div className="mt-6 w-32 text-xs">{t}</div>
                <div className="font-mono text-[10px] text-white/45">{p} réels</div>
              </div>
            ))}
            <div className="absolute top-2 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs" style={{ left: `${(3.3 / 6.5) * 100}%`, borderColor: CYAN, background: "#0d1117" }}>Oral de jeudi</div>
            <Marker n={2} className="left-[44%] -top-2" />
          </div>
          <div className="relative mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Marker n={3} className="-left-3 -top-3" />
            <div className="text-sm">Entre <span className="text-white">Slides client</span> et <span className="text-white">Exercices chap. 3</span> : environ <span className="font-mono" style={{ color: SODIUM }}>3</span> pomodoros.</div>
            <div className="flex gap-2"><Pill>Saisir moi-même</Pill><Pill primary>Garder 3</Pill></div>
          </div>
          <div className="mt-3 text-xs text-white/40">Ce sont des pomodoros réellement passés, pas tes estimations de l&apos;époque.</div>
        </Card>
      </div>
    </div>
  );
}

/* Prévenir à sa pause ------------------------------------------------------ */
export function PrevenirPause() {
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[420px] rounded-2xl border border-white/10 bg-[#0d1117] p-5">
        <Marker n={1} className="-left-3 -top-3" />
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full" style={{ background: CYAN }} />
          <div><div>Léa</div><div className="text-xs text-white/55">En focus · pause vers <span className="font-mono">14:25</span></div></div>
        </div>
        <div className="mt-6 space-y-2">
          <Pill primary>Me prévenir à sa pause</Pill>
          <div className="text-xs text-white/45">Ton message part quand sa pause commence. Elle n&apos;est pas dérangée avant.</div>
        </div>
        <div className="mt-5 rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white/80">tu as les slides de jeudi ?</div>
        <div className="mt-2 flex justify-between text-xs text-white/45"><span>Envoi programmé à sa pause</span><span>Envoyer maintenant</span></div>
      </div>
      <div className="relative flex-1 space-y-4">
        <Marker n={2} className="-left-3 -top-3" />
        <Card>
          <Label>14:25 · chez toi</Label>
          <div className="mt-2 text-sm">Léa est en pause. Ton message vient de partir.</div>
          <div className="mt-3 flex gap-2"><Pill>Ouvrir la conversation</Pill></div>
        </Card>
        <div className="relative">
          <Marker n={3} className="-left-3 -top-3" />
          <Card>
            <Label>14:25 · chez Léa</Label>
            <div className="mt-2 text-sm">Pause. Un message de Tom, gardé pendant ton focus.</div>
            <div className="mt-1 text-xs text-white/45">Pendant le focus : rien ne s&apos;affiche, rien ne sonne.</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* Passer la session sur le téléphone --------------------------------------- */
export function Passage() {
  return (
    <div className="flex w-[1280px] items-center gap-10 bg-[#07090d] p-10 text-white">
      <div className="relative w-[620px]">
        <Marker n={1} className="-left-3 -top-3" />
        <div className="relative h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[url(/rue/dotonbori/still.webp)] bg-cover">
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/75 p-5 text-center">
            <Label>Tu pars ?</Label>
            <div className="mt-2 text-lg">Emporte la session</div>
            <div className="mx-auto mt-4 grid h-28 w-28 grid-cols-7 gap-0.5 rounded bg-white p-2">
              {Array.from({ length: 49 }, (_, i) => <span key={i} className={(i * 11) % 7 < 3 || i % 8 === 0 ? "bg-black" : "bg-white"} />)}
            </div>
            <div className="mt-3 font-mono text-[11px] text-white/50">Pomodoro 3 · 12:40 · Kyoto drive à 23:14</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="font-mono text-2xl text-white/30">→</div>
        <div className="relative h-[560px] w-[270px] overflow-hidden rounded-[40px] border-[10px] border-neutral-800 bg-[url(/rue/kanazawa/still.webp)] bg-cover">
          <Marker n={2} className="left-3 top-14" />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative px-5 pt-16 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Repris du bureau</div>
            <div className="mt-2 font-mono text-5xl tabular-nums" style={{ color: SODIUM }}>12:38</div>
            <div className="mt-2 text-xs text-white/70">Kyoto drive, lofi · 23:16</div>
            <div className="mt-1 text-xs text-white/45">Tâche : Finir le rapport</div>
          </div>
          <div className="relative mx-4 mt-10 rounded-xl border border-white/15 bg-black/60 p-3 text-xs text-white/60">
            <Marker n={3} className="-left-3 -top-3" />
            Sur l&apos;ordinateur : la session s&apos;est arrêtée, rien n&apos;est compté deux fois.
          </div>
        </div>
      </div>
    </div>
  );
}
