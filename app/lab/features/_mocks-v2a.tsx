// Vague 2 : maquettes statiques (rien n'est branché).
import { SessionFrame, AppFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

const NEON = "oklch(0.70 0.20 352)";

/* Lancer en une phrase ----------------------------------------------------- */
export function UnePhrase() {
  return (
    <AppFrame title="Aujourd'hui">
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute left-1/2 top-24 w-[680px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#0f1319] shadow-2xl">
        <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Marker n={1} className="-left-3 -top-3" />
          <span className="font-mono text-xs text-white/40">⌘K</span>
          <span className="text-lg">50 min rapport lofi kyoto<span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-white" /></span>
        </div>
        <div className="relative px-5 py-5">
          <Marker n={2} className="-left-3 top-4" />
          <Label>Compris</Label>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5"><span className="text-white/45">Durée </span>50 min, Deep</span>
            <span className="rounded-lg border px-3 py-1.5" style={{ borderColor: CYAN }}><span className="text-white/45">Tâche </span>Finir le rapport trimestriel</span>
            <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5"><span className="text-white/45">Musique </span>Kyoto drive, lofi</span>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="h-14 w-24 shrink-0 rounded-lg bg-[url(/rue/kanazawa/still.webp)] bg-cover" />
            <div className="text-sm"><div>Kyoto drive, lofi</div><div className="font-mono text-[10px] text-white/45">Abao Vision · trouvé dans ton historique (12 écoutes)</div></div>
          </div>
          <div className="relative mt-5 flex items-center justify-between">
            <Marker n={3} className="-left-8 top-1" />
            <div className="font-mono text-[11px] text-white/45">Entrée : démarrer · Tab : modifier un élément</div>
            <Pill primary>Démarrer</Pill>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-3 font-mono text-[11px] text-white/35">
          Marche aussi : « 25 min maths », « deep spotify », un lien YouTube collé, « comme hier »
        </div>
      </div>
    </AppFrame>
  );
}

/* Pad musical -------------------------------------------------------------- */
export function PadMusical() {
  const dots: [number, number, string][] = [
    [18, 70, "Piano pluie"], [26, 62, "Jeju nuit"], [35, 75, "Ghibli piano"], [55, 40, "Kyoto drive"], [62, 30, "Nujabes"],
    [78, 22, "Synthwave run"], [84, 55, "Game OST mix"], [44, 58, "Study with me Osaka"], [70, 72, "Découverte : city lights"], [22, 30, "Ambient Fuji"],
  ];
  return (
    <AppFrame title="Écouter">
      <Label>Écouter · Pad</Label>
      <h1 className="mt-2 text-2xl font-semibold">De quoi as-tu besoin ?</h1>
      <div className="relative mt-6 flex gap-8">
        <div className="relative h-[460px] w-[620px] rounded-2xl border border-white/10 bg-white/[0.03]">
          <Marker n={1} className="-left-3 -top-3" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" /><div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
          <span className="absolute left-3 top-1/2 -translate-y-6 font-mono text-[10px] text-white/40">CALME</span>
          <span className="absolute right-3 top-1/2 -translate-y-6 font-mono text-[10px] text-white/40">ÉNERGIE</span>
          <span className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[10px] text-white/40">CONNU</span>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] text-white/40">NOUVEAU</span>
          {dots.map(([x, y, t]) => (
            <span key={t} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" style={{ left: `${x}%`, top: `${100 - y}%` }} title={t} />
          ))}
          <div className="absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ left: "58%", top: "62%", borderColor: CYAN, background: "color-mix(in oklch, " + CYAN + " 12%, transparent)" }} />
          <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-black/40" style={{ left: "58%", top: "62%", background: CYAN }} />
          <Marker n={2} className="left-[62%] top-[48%]" />
        </div>
        <div className="relative w-[360px]">
          <Marker n={3} className="-left-3 -top-3" />
          <Card>
            <Label>File construite · 14 titres</Label>
            {["Kyoto drive, lofi", "Study with me, Osaka", "Nujabes - Aruarian Dance", "Découverte : city lights", "Game OST mix"].map((t, i) => (
              <div key={t} className="mt-3 flex items-center gap-3 text-sm"><span className="w-4 font-mono text-[10px] text-white/40">{i + 1}</span><span className={i === 3 ? "text-white/60" : ""}>{t}</span></div>
            ))}
            <div className="mt-5 text-xs text-white/45">Assez énergique, plutôt connu, 1 découverte sur 4.</div>
            <div className="mt-4 flex gap-2"><Pill primary>Lancer</Pill><Pill>Remplacer la file</Pill></div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}

/* Téléphone télécommande --------------------------------------------------- */
export function Telecommande() {
  return (
    <div className="flex w-[1280px] items-center gap-12 bg-[#07090d] p-10 text-white">
      <div className="relative w-[720px]">
        <Marker n={1} className="-left-3 -top-3" />
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="relative h-[405px] bg-[url(/rue/dotonbori/still.webp)] bg-cover">
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute right-6 top-5 font-mono text-5xl tabular-nums" style={{ color: SODIUM }}>18:42</div>
            <div className="absolute bottom-5 left-5 flex items-center gap-4 rounded-xl border border-white/15 bg-black/70 p-3">
              <div className="grid h-20 w-20 grid-cols-6 gap-0.5 rounded bg-white p-1.5">
                {Array.from({ length: 36 }, (_, i) => <span key={i} className={(i * 7) % 5 < 2 || i % 7 === 0 ? "bg-black" : "bg-white"} />)}
              </div>
              <div className="text-sm"><div>Télécommande</div><div className="font-mono text-[10px] text-white/50">Scanne avec ton téléphone · code 4F7K</div></div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative h-[600px] w-[290px] overflow-hidden rounded-[44px] border-[10px] border-neutral-800 bg-[#0b0e13]">
        <Marker n={2} className="left-3 top-14" />
        <div className="px-6 pt-14 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Ordinateur · Focus</div>
          <div className="mt-2 font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>18:42</div>
          <div className="mt-2 truncate text-xs text-white/50">Kyoto drive, lofi</div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 px-5">
          <div className="col-span-2 flex h-24 items-center justify-center rounded-2xl bg-white text-lg font-medium text-black">Pause</div>
          <div className="flex h-20 items-center justify-center rounded-2xl border border-white/15 text-sm">Distraction</div>
          <div className="flex h-20 items-center justify-center rounded-2xl border border-white/15 text-sm">Suivant</div>
        </div>
        <div className="relative mx-5 mt-5 rounded-xl border border-white/10 p-3 text-xs text-white/55">
          <Marker n={3} className="-left-3 -top-3" />
          Vibre à la fin du pomodoro. Écran éteint, ça marche encore.
        </div>
      </div>
    </div>
  );
}

/* Ancrage sonore ----------------------------------------------------------- */
export function Ancrage() {
  return (
    <AppFrame title="Organisation">
      <Label>Organisation · Projets</Label>
      <h1 className="mt-2 text-2xl font-semibold">Mémoire</h1>
      <div className="relative mt-6 grid grid-cols-12 gap-6">
        <Card className="col-span-7">
          <Marker n={1} className="-left-3 -top-3" />
          <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-violet-400" /><span className="text-lg">Mémoire de master</span></div>
          <div className="mt-5"><Label>Morceau d&apos;ancrage</Label></div>
          <div className="mt-3 flex items-center gap-4 rounded-xl border p-3" style={{ borderColor: CYAN }}>
            <div className="h-14 w-24 shrink-0 rounded-lg bg-[url(/rue/sapa/still.webp)] bg-cover" />
            <div className="flex-1 text-sm"><div>Joe Hisaishi - One Summer&apos;s Day (piano)</div><div className="font-mono text-[10px] text-white/45">joué en premier à chaque session sur ce projet, jamais ailleurs</div></div>
          </div>
          <div className="mt-4 text-sm text-white/60">Choisi automatiquement à la 1re session du projet : le premier titre que tu as écouté jusqu&apos;au bout.</div>
          <div className="mt-4 flex gap-2"><Pill>Changer de morceau</Pill><Pill>Désactiver</Pill></div>
        </Card>
        <div className="relative col-span-5 space-y-4">
          <Marker n={2} className="-left-3 -top-3" />
          <Card>
            <Label>Au lancement d&apos;une session « Mémoire »</Label>
            <ol className="mt-3 space-y-2 text-sm text-white/75">
              <li>1. Le morceau d&apos;ancrage démarre, seul, 3 min.</li>
              <li>2. Puis ta musique habituelle prend le relais.</li>
              <li>3. Ce morceau est retiré de toutes tes autres files.</li>
            </ol>
          </Card>
          <Card className="relative">
            <Marker n={3} className="-left-3 -top-3" />
            <div className="text-sm text-white/70">Ajouté par erreur à la File d&apos;attente : « Ce morceau est l&apos;ancrage de Mémoire. Le garder pour ce projet ? »</div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}

/* Le pomodoro qui commence petit ------------------------------------------- */
export function CommencePetit() {
  return (
    <div className="flex w-[1280px] gap-6 bg-[#07090d] p-6 text-white">
      {[
        { t: "02:00", sub: "Juste 2 minutes. Ouvre le fichier.", p: 0, n: 1, prog: 0, label: "Engagement" },
        { t: "00:14", sub: "Tu es toujours là.", p: 1, n: 2, prog: 0.9, label: "Engagement" },
        { t: "22:46", sub: "Pomodoro 1 · les 2 minutes comptent", p: 2, n: 3, prog: 0.09, label: "Pomodoro 1" },
      ].map((s) => (
        <div key={s.n} className="relative h-[420px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[url(/rue/ninenzaka/still.webp)] bg-cover">
          <div className="absolute inset-0 bg-black/55" />
          <Marker n={s.n} className="left-3 top-3" />
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{s.label}</div>
            <div className="mt-2 font-mono text-6xl tabular-nums" style={{ color: s.p === 2 ? SODIUM : "white" }}>{s.t}</div>
            <div className="mt-3 h-px w-48 bg-white/15"><div className="h-px" style={{ width: `${s.prog * 100}%`, background: s.p === 2 ? SODIUM : CYAN }} /></div>
            <div className="mt-4 max-w-[240px] text-sm text-white/70">{s.sub}</div>
            {s.p === 1 && <div className="mt-6 font-mono text-[10px] text-white/40">Aucun clic. Rien ne s&apos;arrête.</div>}
            {s.p === 0 && <div className="mt-6 flex gap-2"><Pill primary>Démarrer 2 min</Pill></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* La mélodie de la journée ------------------------------------------------- */
export function Melodie() {
  const notes = [0, 2, 4, 5, 7, 9, 11, 12];
  const done = 5;
  return (
    <SessionFrame still="/rue/hoian-nuit/still.webp">
      <div className="absolute left-8 top-8 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Pause courte</div>
      <div className="absolute right-8 top-7 font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>05:00</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative">
          <Marker n={1} className="-left-10 top-0" />
          <div className="flex items-end gap-6">
            {notes.map((n, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className={"rounded-full " + (i === done - 1 ? "h-5 w-5" : "h-3.5 w-3.5")}
                  style={{ marginBottom: n * 9, background: i < done ? (i === done - 1 ? NEON : CYAN) : "transparent", border: i < done ? "none" : "1px dashed rgba(255,255,255,.35)" }} />
                <span className="font-mono text-[10px] text-white/40">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-10 text-center">
          <Marker n={2} className="-left-10 top-0" />
          <div className="text-lg">Cinquième note.</div>
          <div className="mt-1 text-sm text-white/55">La phrase se termine au pomodoro 8, ton objectif.</div>
        </div>
      </div>
      <div className="absolute bottom-8 left-8 w-80 rounded-xl border border-white/15 bg-black/60 p-4 text-sm text-white/70">
        <Marker n={3} className="-left-3 -top-3" />
        Le son de fin n&apos;est pas une alarme : c&apos;est la note suivante. Une phrase par jour, jamais la même deux jours de suite.
      </div>
    </SessionFrame>
  );
}
