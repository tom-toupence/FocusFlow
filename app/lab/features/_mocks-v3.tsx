// Vague 3 : maquettes statiques (mode PROPOSITION, rien n'est branché).
import type { ReactNode } from "react";
import { SessionFrame, AppFrame, Label, Pill, Card, Marker, CYAN, SODIUM } from "./_shared";

const WARM = "oklch(0.86 0.11 80)";

/** Téléphone dessiné (portrait par défaut). */
function Phone({ children, still, className = "", landscape }: { children?: ReactNode; still?: string; className?: string; landscape?: boolean }) {
  return (
    <div
      className={"relative shrink-0 overflow-hidden border-[9px] border-neutral-800 bg-black bg-cover bg-center " + (landscape ? "h-[230px] w-[470px] rounded-[34px] " : "h-[470px] w-[230px] rounded-[34px] ") + className}
      style={still ? { backgroundImage: `url(${still})` } : undefined}
    >
      {children}
    </div>
  );
}

/* 1. Le téléphone se pilote par sa position ------------------------------- */
export function TelephonePosition() {
  return (
    <div className="w-[1280px] bg-[#07090d] p-10 text-white">
      <Label>Le téléphone se pilote par sa position</Label>
      <div className="mt-6 grid grid-cols-3 gap-8">
        <div className="relative flex flex-col items-center gap-4">
          <Marker n={1} className="left-4 top-0" />
          <Phone still="/rue/kanazawa/still.webp">
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative px-4 pt-12 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">En main</div>
              <div className="mt-2 font-mono text-5xl tabular-nums" style={{ color: SODIUM }}>18:42</div>
              <div className="mt-2 text-xs text-white/70">Kyoto drive, lofi</div>
              <div className="mx-auto mt-24 w-fit"><Pill primary>Démarrer</Pill></div>
            </div>
          </Phone>
          <div className="text-center text-sm text-white/70">Debout ou en main : la session normale.</div>
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <Marker n={2} className="left-4 top-0" />
          <div className="relative">
            <Phone className="!bg-black">
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="font-mono text-sm tabular-nums" style={{ color: SODIUM, opacity: 0.55 }}>18:41</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/25">écran noir · musique en cours</div>
              </div>
            </Phone>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-[#0d1117] px-2 py-1 font-mono text-[10px] text-white/60">face contre la table</div>
          </div>
          <div className="text-center text-sm text-white/70">Retourné : le focus démarre. L&apos;écran est noir mais reste allumé, donc YouTube continue de jouer.</div>
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <Marker n={3} className="left-4 top-0" />
          <div className="relative h-[470px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[url(/rue/dotonbori/still.webp)] bg-cover">
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute left-10 top-5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">Sur l&apos;ordinateur</div>
            <div className="absolute right-4 top-4 font-mono text-4xl tabular-nums" style={{ color: SODIUM }}>18:41</div>
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/15 bg-black/70 p-4 text-sm">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Téléphone appairé</div>
              <div className="mt-2 text-white/65">Tu le retournes : la session de l&apos;ordinateur démarre. Tu le reprends en main : elle se met en pause, la musique aussi.</div>
              <div className="mt-3 font-mono text-[10px] text-white/40">Rien n&apos;est compté comme distraction. C&apos;est juste un interrupteur.</div>
            </div>
          </div>
          <div className="text-center text-sm text-white/70">Avec un ordinateur : le téléphone devient l&apos;interrupteur.</div>
        </div>
      </div>
      <div className="relative mt-10 flex items-center gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <Marker n={4} className="-left-3 -top-3" />
        <Phone landscape still="/rue/gion-nuit/still.webp" className="!h-[150px] !w-[300px]">
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute right-3 top-2 font-mono text-xl tabular-nums" style={{ color: SODIUM }}>18:40</div>
        </Phone>
        <div className="text-sm text-white/70">
          <div className="text-white">Couché sur le côté : la vue session (vidéo plein écran).</div>
          <div className="mt-1">Debout : tâches et contrôles. Aucun bouton à chercher, la position suffit.</div>
        </div>
      </div>
    </div>
  );
}

/* 2. Les fenêtres allumées ------------------------------------------------ */
export function Fenetres() {
  const wins: [number, number, string | null][] = [[22, 30, null], [31, 24, "Léa"], [64, 21, null], [71, 34, "Sam"], [80, 27, null], [12, 45, null]];
  return (
    <SessionFrame still="/rue/hoian-nuit/still.webp">
      <div className="absolute inset-0 bg-black/10" />
      {wins.map(([x, y, who], i) => (
        <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
          <div className="h-7 w-5 rounded-[2px]" style={{ background: who ? WARM : "rgba(255,220,160,.18)", boxShadow: who ? `0 0 22px 6px color-mix(in oklch, ${WARM} 55%, transparent)` : "none" }} />
          {who === "Léa" && (
            <div className="absolute left-7 top-0 whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[11px]">Léa travaille</div>
          )}
        </div>
      ))}
      <Marker n={1} className="left-[29%] top-[22%]" />
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Pause</div>
        <div className="font-mono text-7xl tabular-nums" style={{ color: CYAN }}>04:12</div>
      </div>
      <div className="absolute bottom-8 left-8 w-[420px] rounded-xl border border-white/15 bg-black/65 p-4 text-sm">
        <Marker n={2} className="-left-3 -top-3" />
        <div>Deux fenêtres allumées dans ta rue : deux amis encore au travail.</div>
        <div className="mt-1 text-xs text-white/50">Chaque ami a toujours la même fenêtre. Pas de nom affiché, sauf au survol. Pas de chiffre.</div>
      </div>
      <div className="absolute bottom-8 right-8 w-[380px] rounded-xl border border-white/15 bg-black/65 p-4 text-sm">
        <Marker n={3} className="-left-3 -top-3" />
        <div>Et ton focus allume ta fenêtre chez eux.</div>
        <div className="mt-1 text-xs text-white/50">Quand un ami finit un pomodoro, sa fenêtre grésille une seconde. Rien ne sonne, rien à répondre.</div>
      </div>
    </SessionFrame>
  );
}

/* 3. Les morceaux dans les mixes ----------------------------------------- */
export function MorceauxMixes() {
  const ch: [string, string, boolean?][] = [["00:00", "Kudasai, Love you"], ["03:12", "Tomppabeats, Monday Loop"], ["05:48", "Jinsang, Affection", true], ["08:30", "Idealism, Controlla"], ["11:02", "Philanthrope, Hold On"]];
  return (
    <SessionFrame still="/rue/sannenzaka/still.webp">
      <div className="absolute left-8 top-8">
        <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Jinsang, Affection</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">Morceau 3 / 24 dans « lofi hip hop, 1 hour mix »</div>
        <Marker n={1} className="-left-7 top-0" />
      </div>
      <div className="absolute right-8 top-7 text-right">
        <div className="font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>17:05</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Pomodoro 2</div>
      </div>
      <div className="absolute bottom-28 right-8 w-[420px] rounded-xl border border-white/15 bg-black/70 p-4">
        <Marker n={2} className="-left-3 -top-3" />
        <Label>À venir, dans ce mix</Label>
        <div className="mt-3 space-y-1">
          {ch.map(([t, title, now]) => (
            <div key={t} className={"flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm " + (now ? "bg-white/10" : "")}>
              <span className="w-12 font-mono text-[11px] text-white/45">{t}</span>
              <span className="flex-1 truncate">{title}</span>
              {now && <span className="rounded-md border px-2 py-0.5 text-[11px]" style={{ borderColor: CYAN }}>Garder</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-white/50">Lus dans les chapitres de la vidéo ou dans la liste horodatée de sa description.</div>
      </div>
      <div className="absolute bottom-28 left-8 w-[420px] rounded-xl border border-white/15 bg-black/70 p-4 text-sm">
        <Marker n={3} className="-left-3 -top-3" />
        <div>« Garder » met ce passage (05:48 à 08:30) dans une de tes playlists.</div>
        <div className="mt-1 text-xs text-white/50">Rejoué plus tard, il commence et s&apos;arrête pile, comme un vrai titre.</div>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2">
        <Pill primary>Pause</Pill><Pill>Distraction</Pill><Pill active>Suivant : morceau 4</Pill><Pill>À venir</Pill><Pill>Tâches</Pill>
      </div>
    </SessionFrame>
  );
}

/* 4. Sur l'autre écran ---------------------------------------------------- */
export function AutreEcran() {
  return (
    <div className="w-[1280px] bg-[#07090d] p-10 text-white">
      <div className="flex items-end justify-center gap-6">
        <div className="relative">
          <Marker n={1} className="-left-3 -top-3" />
          <div className="h-[300px] w-[520px] overflow-hidden rounded-xl border-[8px] border-neutral-800 bg-[#1b1f27] p-4 font-mono text-[11px] leading-5 text-white/50">
            <div className="mb-2 flex gap-2 text-white/30"><span>rapport.md</span><span>·</span><span>index.ts</span></div>
            {["## Résultats du trimestre", "Le chiffre d'affaires progresse de 12 %", "porté par l'export. Les marges restent", "stables malgré la hausse des coûts.", "", "## Prochaines étapes", "- relancer les deux clients en attente", "- finaliser le tableau des charges"].map((l, i) => <div key={i}>{l || " "}</div>)}
          </div>
          <div className="mx-auto h-6 w-24 bg-neutral-800" />
          <div className="mt-2 text-center text-xs text-white/45">Écran principal : ton travail, rien d&apos;autre</div>
        </div>
        <div className="relative">
          <Marker n={2} className="-left-3 -top-3" />
          <div className="relative h-[300px] w-[520px] overflow-hidden rounded-xl border-[8px] border-neutral-800 bg-[url(/rue/kanazawa/still.webp)] bg-cover">
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute left-4 top-4 flex items-center gap-2 text-xs"><span className="h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} />Study with me, Kanazawa</div>
            <div className="absolute right-4 top-3 font-mono text-4xl tabular-nums" style={{ color: SODIUM }}>21:07</div>
          </div>
          <div className="mx-auto h-6 w-24 bg-neutral-800" />
          <div className="mt-2 text-center text-xs text-white/45">Second écran : la session en plein écran, comme une fenêtre</div>
        </div>
      </div>
      <div className="mt-8 flex justify-center gap-6">
        <div className="relative w-[520px] rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <Marker n={3} className="-left-3 -top-3" />
          <Label>Au démarrage d&apos;une session</Label>
          <div className="mt-3 flex items-center gap-3"><Pill primary>Démarrer sur l&apos;autre écran</Pill><Pill>Ici</Pill></div>
          <div className="mt-3 text-xs text-white/50">Choisi une fois, retenu ensuite. Écran débranché : la session revient ici, sans s&apos;arrêter.</div>
        </div>
        <div className="w-[520px] rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/65">
          <Label>Aujourd&apos;hui</Label>
          <div className="mt-3">Glisser l&apos;onglet hors de la fenêtre, la déplacer sur l&apos;autre écran, passer en plein écran : 3 gestes à chaque session.</div>
        </div>
      </div>
    </div>
  );
}

/* 5. La session sans antichambre ----------------------------------------- */
export function Seuil() {
  return (
    <SessionFrame still="/rue/ninenzaka/still.webp">
      <div className="absolute left-8 top-8">
        <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Kyoto, Ninenzaka au petit matin</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">La vidéo joue déjà. Rien n&apos;est lancé.</div>
        <Marker n={1} className="-left-7 top-0" />
      </div>
      <div className="absolute right-8 top-7 text-right">
        <div className="font-mono text-6xl tabular-nums text-white/55">25:00</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Prêt · Espace pour démarrer</div>
      </div>
      <div className="absolute inset-x-8 bottom-24 rounded-2xl border border-white/15 bg-black/75 p-5">
        <Marker n={2} className="-left-3 -top-3" />
        <div className="flex gap-6">
          <div className="flex-1">
            <Label>Ambiance</Label>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["ninenzaka", "kanazawa", "hoian", "sapa"].map((s, i) => (
                <div key={s} className={"h-16 rounded-lg bg-cover bg-center " + (i === 0 ? "ring-2 ring-white" : "opacity-70")} style={{ backgroundImage: `url(/rue/${s}/still.webp)` }} />
              ))}
            </div>
            <div className="mt-2 font-mono text-[10px] text-white/40">Catalogue · Bibliothèque · Récents · Spotify · Twitch</div>
          </div>
          <div className="w-56">
            <Label>Rythme</Label>
            <div className="mt-3 flex flex-wrap gap-2"><Pill active>25 / 5</Pill><Pill>50 / 10</Pill><Pill>Flowtime</Pill></div>
          </div>
          <div className="w-64">
            <Label>Tâche</Label>
            <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm">Finir le rapport trimestriel</div>
            <div className="mt-1 text-[11px] text-white/45">+ 2 autres, gardées</div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2">
        <Marker n={3} className="-left-9 top-1.5" />
        <Pill primary>Démarrer</Pill><Pill active>Ambiance</Pill><Pill>Rythme</Pill><Pill>Tâches</Pill>
      </div>
    </SessionFrame>
  );
}

export function SeuilEnCours() {
  return (
    <SessionFrame still="/rue/kanazawa/still.webp">
      <div className="absolute left-8 top-8">
        <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Kanazawa, Higashi Chaya</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">Changée en cours de pomodoro</div>
      </div>
      <div className="absolute right-8 top-7 text-right">
        <div className="relative font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>13:51<Marker n={1} className="-left-9 top-3" /></div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Pomodoro 3 · le minuteur n&apos;a pas bougé</div>
      </div>
      <div className="absolute bottom-24 left-1/2 w-[640px] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/75 p-5 text-sm">
        <Marker n={2} className="-left-3 -top-3" />
        <div>Ambiance changée en 2 gestes. Le pomodoro continue, la tâche aussi.</div>
        <div className="mt-2 text-xs text-white/50">Avant : Terminer, Accueil, Écouter, une vignette, Démarrer, « Garder les tâches », et le pomodoro repartait à 25:00.</div>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2"><Pill primary>Pause</Pill><Pill>Distraction</Pill><Pill>Suivant</Pill><Pill>Ambiance</Pill><Pill>Rythme</Pill><Pill>Tâches</Pill><Pill>Terminer</Pill></div>
    </SessionFrame>
  );
}

/* 6. Ta playlist Spotify, sans Premium ----------------------------------- */
export function SpotifySansPremium() {
  const rows: [string, string, string, string, boolean][] = [
    ["Nujabes, Aruarian Dance", "4:03", "Nujabes - Aruarian Dance", "4:04", true],
    ["Joji, Slow Dancing in the Dark", "3:29", "Joji - SLOW DANCING IN THE DARK (Audio)", "3:29", true],
    ["Mndsgn, Camelblues", "2:54", "Mndsgn - Camelblues", "2:55", true],
    ["Ichika Nito, i miss you", "1:58", "2 résultats proches, à choisir", "", false],
  ];
  return (
    <AppFrame title="Écouter">
      <Label>Coller un lien Spotify</Label>
      <div className="relative mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm text-white/80">
        open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n
        <Marker n={1} className="-left-3 -top-3" />
      </div>
      <div className="relative mt-6">
        <Marker n={2} className="-left-3 -top-3" />
        <Card>
          <div className="flex items-center justify-between">
            <div><div className="text-lg">late night coding</div><div className="text-xs text-white/50">48 titres · pas de compte Spotify nécessaire, pas de Premium</div></div>
            <div className="flex gap-2"><Pill primary>Lire en session</Pill><Pill>Mettre en playlist</Pill></div>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_60px_24px_1fr_60px] items-center gap-x-3 gap-y-2 text-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Sur Spotify</div><div /><div /><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Joué depuis YouTube</div><div />
            {rows.map(([a, da, b, db, ok]) => (
              <div key={a} className="contents">
                <div className="truncate">{a}</div><div className="font-mono text-xs text-white/45">{da}</div>
                <div className="text-white/30">→</div>
                <div className={"truncate " + (ok ? "text-white/80" : "")} style={ok ? undefined : { color: SODIUM }}>{b}</div><div className="font-mono text-xs text-white/45">{db}</div>
              </div>
            ))}
          </div>
          <div className="relative mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
            <Marker n={3} className="-left-3 -top-3" />
            Chaque titre est cherché sur YouTube (artiste + titre), et on garde celui dont la durée colle à la seconde près. Les 3 premiers sont prêts tout de suite, le reste arrive pendant que tu écoutes.
          </div>
        </Card>
      </div>
    </AppFrame>
  );
}

/* 7. Un titre pour toi ---------------------------------------------------- */
export function TitrePourToi() {
  return (
    <div className="flex w-[1280px] gap-8 bg-[#07090d] p-8 text-white">
      <div className="relative w-[420px] rounded-2xl border border-white/10 bg-[#0d1117] p-5">
        <Marker n={1} className="-left-3 -top-3" />
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full" style={{ background: CYAN }} />
          <div><div>Léa</div><div className="text-xs text-white/55">En focus · Study with me, Osaka</div></div>
        </div>
        <div className="mt-6"><Label>Lui glisser un titre</Label></div>
        <div className="mt-3 space-y-2">
          {[["Nujabes, Aruarian Dance", true], ["Kyoto drive, lofi", false], ["Mndsgn, Camelblues", false]].map(([t, sel]) => (
            <div key={String(t)} className={"flex items-center justify-between rounded-lg border px-3 py-2 text-sm " + (sel ? "" : "border-white/10")} style={sel ? { borderColor: CYAN } : undefined}>
              <span>{t as string}</span>{sel && <span className="text-[11px] text-white/60">choisi</span>}
            </div>
          ))}
        </div>
        <div className="mt-4"><Pill primary>Glisser dans sa file</Pill></div>
        <div className="mt-3 text-xs text-white/45">Un titre par ami et par jour. Elle n&apos;a rien à répondre.</div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[url(/rue/dotonbori/still.webp)] bg-cover">
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Chez Léa, pendant son focus</div>
        <div className="absolute right-5 top-4 font-mono text-4xl tabular-nums" style={{ color: SODIUM }}>08:20</div>
        <div className="absolute bottom-6 right-6 w-[370px] rounded-xl border border-white/15 bg-black/75 p-4">
          <Marker n={2} className="-left-3 -top-3" />
          <Label>À venir</Label>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between rounded-lg bg-white/10 px-2 py-1.5"><span>Study with me, Osaka</span><span className="font-mono text-[11px] text-white/45">en cours</span></div>
            <div className="flex justify-between rounded-lg px-2 py-1.5"><span>Nujabes, Aruarian Dance</span><span className="text-[11px]" style={{ color: CYAN }}>de Tom</span></div>
            <div className="flex justify-between rounded-lg px-2 py-1.5 text-white/60"><span>Jinsang, Affection</span><span /></div>
          </div>
        </div>
        <div className="absolute bottom-6 left-6 w-[310px] rounded-xl border border-white/15 bg-black/70 p-4 text-sm">
          <Marker n={3} className="-left-3 -top-3" />
          <div>Il passe à la fin du titre en cours, pas avant.</div>
          <div className="mt-1 text-xs text-white/50">Pas de notification pendant le focus. Elle peut le retirer d&apos;un geste, Tom ne le saura pas.</div>
        </div>
      </div>
    </div>
  );
}

/* 8. Rien n'est perdu ----------------------------------------------------- */
export function RienPerdu() {
  return (
    <SessionFrame still="/rue/gion-nuit/still.webp">
      <div className="absolute right-8 top-7 text-right">
        <div className="font-mono text-6xl tabular-nums" style={{ color: SODIUM }}>15:00</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">Commencé il y a 10 min · déjà comptées</div>
      </div>
      <div className="absolute left-8 top-24 w-[400px] rounded-2xl border border-white/15 bg-black/75 p-5">
        <Marker n={1} className="-left-3 -top-3" />
        <Label>Tu as commencé sans moi ?</Label>
        <div className="mt-3 flex gap-2"><Pill>il y a 5 min</Pill><Pill active>il y a 10 min</Pill><Pill>il y a 15 min</Pill></div>
        <div className="mt-3 text-xs text-white/50">Le pomodoro démarre là où tu en es vraiment. Ces minutes comptent.</div>
      </div>
      <div className="absolute left-8 top-[300px] w-[400px] rounded-2xl border border-white/15 bg-black/75 p-5">
        <Marker n={2} className="-left-3 -top-3" />
        <Label>Tu t&apos;es levé ?</Label>
        <div className="mt-3 text-sm">J&apos;ai arrêté de travailler à <span className="rounded-md border border-white/20 px-2 py-0.5 font-mono">14:52</span></div>
        <div className="mt-3 text-xs text-white/50">Les minutes d&apos;après ne sont pas comptées, et le pomodoro reprend à ce point-là.</div>
      </div>
      <div className="absolute bottom-24 left-1/2 flex w-[560px] -translate-x-1/2 items-center justify-between rounded-xl border border-white/15 bg-[#0d1117] px-5 py-3 text-sm">
        <Marker n={3} className="-left-3 -top-3" />
        <span>Session terminée.</span>
        <span className="flex items-center gap-3"><span className="font-mono text-[11px] text-white/40">ctrl Z</span><Pill primary>Annuler</Pill></span>
      </div>
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2"><Pill primary>Pause</Pill><Pill>Distraction</Pill><Pill>Suivant</Pill><Pill>Tâches</Pill><Pill>Terminer</Pill></div>
    </SessionFrame>
  );
}

/* 9. Coller pour lancer --------------------------------------------------- */
export function Coller() {
  return (
    <AppFrame title="Organisation">
      <div className="opacity-40">
        <Label>Organisation · Planning</Label>
        <div className="mt-3 h-8 w-64 rounded-lg bg-white/10" />
        <div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 21 }, (_, i) => <div key={i} className="h-16 rounded-lg bg-white/[0.06]" />)}</div>
      </div>
      <div className="absolute left-1/2 top-1/2 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0f1319] p-5 shadow-2xl">
        <Marker n={1} className="-left-3 -top-3" />
        <div className="flex items-center justify-between">
          <Label>Lien collé</Label>
          <span className="font-mono text-[11px] text-white/40">ctrl V, n&apos;importe où</span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-36 shrink-0 rounded-lg bg-[url(/rue/hoian/still.webp)] bg-cover" />
          <div className="min-w-0">
            <div className="truncate">Hoi An morning walk, 4K</div>
            <div className="font-mono text-[11px] text-white/45">Vidéo YouTube · titre et chaîne trouvés tout seuls</div>
          </div>
        </div>
        <div className="relative mt-5 flex gap-2">
          <Marker n={2} className="-left-8 top-1.5" />
          <Pill primary>Lancer</Pill><Pill>File d&apos;attente</Pill><Pill>Bibliothèque</Pill><Pill>Une playlist</Pill>
        </div>
        <div className="relative mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
          <Marker n={3} className="-left-3 -top-3" />
          Reconnaît aussi : playlist YouTube, mix radio, playlist Spotify, chaîne Twitch. Ou glisse le lien depuis un autre onglet sur la fenêtre.
        </div>
      </div>
    </AppFrame>
  );
}

/* 10. Organisation en deux vues ------------------------------------------ */
export function OrganisationDeuxVues() {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
  return (
    <AppFrame title="Organisation">
      <div className="relative flex items-center gap-2">
        <Marker n={1} className="-left-3 -top-3" />
        <span className="rounded-lg bg-white px-3 py-1.5 text-sm text-black">Semaine</span>
        <span className="rounded-lg px-3 py-1.5 text-sm text-white/55">Projets et tâches</span>
        <span className="ml-4 font-mono text-[11px] text-white/35">avant : Projets · Planning · Sprint · Routines · Journal</span>
      </div>
      <div className="mt-6 grid grid-cols-[1fr_300px] gap-6">
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Marker n={2} className="-left-3 -top-3" />
          <div className="grid grid-cols-5 gap-3">
            {days.map((d, i) => (
              <div key={d}>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{d}</div>
                <div className="mt-3 space-y-2">
                  {i < 4 && <div className="rounded-lg border px-2 py-2 text-[11px]" style={{ borderColor: SODIUM }}>Sprint oral · 2 h</div>}
                  {i % 2 === 0 && <div className="rounded-lg border border-dashed border-white/30 px-2 py-2 text-[11px] text-white/70">Réunion 15:00</div>}
                  <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-[11px]">Matin calme · 50/10</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-white/50">Blocs de sprint, routines récurrentes et rendez-vous de l&apos;agenda au même endroit.</div>
        </div>
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Marker n={3} className="-left-3 -top-3" />
          <Label>Tâches</Label>
          <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/45">Ajouter une tâche, Entrée</div>
          <div className="mt-3 space-y-2 text-sm">
            {["Préparer l'oral de jeudi", "Relire l'article", "Slides client"].map((t) => <div key={t} className="rounded-lg border border-white/10 px-3 py-2">{t}</div>)}
          </div>
          <div className="mt-3 text-xs text-white/45">Avant, les tâches n&apos;existaient que dans les réglages de session.</div>
        </div>
      </div>
    </AppFrame>
  );
}
