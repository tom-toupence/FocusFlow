"use client";

// /_design : vitrine interne du système « la ville qui ne dort pas ».
// Montre chaque token et chaque composant de base dans ses états, dans le
// thème courant (bascule en haut). Sert aussi de banc de capture pour les
// critiques (scripts/shoot.mjs).
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CityHandle } from "@/components/CityScene";
import { useThemeStore } from "@/store/themeStore";
import { defaultVideos, getVideoColor } from "@/data/videos";
import { Button, IconButton } from "@/components/ff/Button";
import { Field } from "@/components/ff/Field";
import { Segmented } from "@/components/ff/Segmented";
import { Gauge, type GaugePulse } from "@/components/ff/Gauge";
import { MediaCard } from "@/components/ff/MediaCard";
import { TrackRow } from "@/components/ff/TrackRow";
import { PlayerControls } from "@/components/ff/PlayerControls";
import { Modal } from "@/components/ff/Modal";
import { EmptyState, SectionTitle, Skeleton } from "@/components/ff/States";
import { toast } from "@/components/Toast";
import {
  IconClose, IconHelp, IconMoon, IconMore, IconPip, IconPlay, IconPlus, IconStone, IconSun, IconTasks,
} from "@/components/ff/icons";

const CityScene = dynamic(() => import("@/components/CityScene"), { ssr: false });

const SWATCHES = [
  ["bg", "Fond"], ["surface", "Surface"], ["surface-2", "Surface creusée"], ["line", "Filet"],
  ["line-strong", "Filet fort"], ["text", "Encre"], ["text-2", "Encre 2"], ["text-3", "Encre 3"],
  ["sodium", "Sodium · maintenant"], ["sodium-text", "Sodium texte"], ["konbini", "Supérette · fait"],
  ["taxi", "Taxi · événement"], ["danger", "Feu arrière · alerte"],
] as const;

const TYPE = [
  { cls: "font-display text-[clamp(2.6rem,7vw,4.6rem)] font-extrabold uppercase leading-[0.9]", name: "Enseigne · Big Shoulders 800", txt: "La ville ne dort pas" },
  { cls: "font-display text-[2rem] font-bold leading-tight", name: "Titre 1 · Big Shoulders 700", txt: "Choisis ton ambiance" },
  { cls: "font-display text-xl font-bold", name: "Titre 2 · Big Shoulders 700", txt: "File d'attente" },
  { cls: "text-[17px] leading-relaxed", name: "Corps large · Atkinson Next", txt: "La file se prolonge avec des titres proches de ta playlist." },
  { cls: "text-sm leading-relaxed", name: "Corps · Atkinson Next", txt: "Marque une distraction avec la touche D. Rien n'est détecté tout seul." },
  { cls: "text-[13px] text-ink-2", name: "Légende · Atkinson Next", txt: "Lancée 8 fois, souvent vers 22 h" },
  { cls: "font-led text-[56px] leading-none text-sodium", name: "Panneau LED · Doto 700", txt: "24:58" },
  { cls: "font-mono text-xs text-ink-3", name: "Chiffres · Atkinson tabulaires", txt: "21:00  21:25  21:30" },
];

const RADII = [["--r-hair", "Instrument"], ["--r-media", "Média"], ["--r-control", "Contrôle"], ["--r-surface", "Surface"]];
const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 96];
const EASES = [
  ["--ease-ui", "Interface", "160 ms"], ["--ease-fall", "Coupure", "520 ms"],
  ["--ease-settle", "Arrêt", "900 ms"], ["--ease-tide", "Nuit", "4 s"],
];

export default function DesignPage() {
  const { theme, toggle } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const [pulse, setPulse] = useState<GaugePulse | null>(null);
  const [level, setLevel] = useState(0.42);
  const [modal, setModal] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(true);
  const [easeRun, setEaseRun] = useState(0);
  const vids = defaultVideos.slice(0, 4);
  const city = useRef<CityHandle>(null);
  const [halte, setHalte] = useState(false);
  const [mins, setMins] = useState(25);
  const [friends, setFriends] = useState(3);

  return (
    <main className="min-h-screen bg-bg text-ink">
      {/* React 19 hisse ces balises dans <head> : page interne non indexée. */}
      <title>Système · FocusFlow</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-16 flex flex-col gap-16">
        <header className="flex flex-wrap items-end gap-4 border-b border-line pb-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-ink-3">docs/redesign/03-SYSTEM.md</p>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.8rem)] font-extrabold uppercase leading-[0.9] mt-2">La ville qui ne dort pas</h1>
            <p className="mt-3 text-ink-2 max-w-xl">
              Le système de FocusFlow : la nuit par défaut, le petit matin en thème clair. Chaque lumière a un rôle.
            </p>
          </div>
          <Button variant="line" onClick={toggle} aria-label="Changer de thème">
            {mounted && theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            {mounted ? (theme === "dark" ? "Petit matin" : "Nuit") : "Thème"}
          </Button>
        </header>

        {/* ── Couleurs ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle measure="AA vérifié · scripts/contrast.mjs">Couleurs</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-5">
            {SWATCHES.map(([v, name]) => (
              <div key={v} className="flex flex-col gap-2">
                <span className="h-14 rounded-[var(--r-media)] border border-line" style={{ background: `var(--${v})` }} />
                <span className="text-[13px]">{name}</span>
                <span className="font-mono text-[11px] text-ink-3">--{v}</span>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <span className="h-14 rounded-[var(--r-media)] flex">
                {vids.map((v) => <span key={v.id} className="flex-1 first:rounded-l-[var(--r-media)] last:rounded-r-[var(--r-media)]" style={{ background: getVideoColor(v) }} />)}
              </span>
              <span className="text-[13px]">Reflet</span>
              <span className="font-mono text-[11px] text-ink-3">couleur de la vidéo</span>
            </div>
          </div>
        </section>

        {/* ── Typographie ────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Typographie</SectionTitle>
          <div className="flex flex-col divide-y divide-line">
            {TYPE.map((t) => (
              <div key={t.name} className="grid sm:grid-cols-[14rem_1fr] gap-2 sm:gap-6 py-4 items-baseline">
                <span className="font-mono text-[11px] text-ink-3">{t.name}</span>
                <span className={t.cls}>{t.txt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Espace, rayons, élévation ──────────────────────────── */}
        <section className="grid md:grid-cols-3 gap-10">
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Espacements</SectionTitle>
            {SPACE.map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-8 font-mono text-[11px] text-ink-3 text-right">{n}</span>
                <span className="h-2 bg-sodium rounded-[1px]" style={{ width: n * 2 }} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Rayons</SectionTitle>
            {RADII.map(([v, n]) => (
              <div key={v} className="flex items-center gap-3">
                <span className="w-14 h-10 border border-line-strong bg-surface" style={{ borderRadius: `var(${v})` }} />
                <span className="text-[13px]">{n}</span>
                <span className="font-mono text-[11px] text-ink-3">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Élévation</SectionTitle>
            <div className="h-14 rounded-[var(--r-surface)] bg-surface border border-line flex items-center px-4 text-[13px]">0 · posée (la plupart)</div>
            <div className="h-14 rounded-[var(--r-surface)] bg-surface shadow-[var(--shadow-float)] flex items-center px-4 text-[13px]">1 · flottante (menus)</div>
            <div className="h-14 rounded-[var(--r-surface)] bg-surface shadow-[var(--shadow-modal)] flex items-center px-4 text-[13px]">2 · modale (avec voile)</div>
          </div>
        </section>

        {/* ── Mouvement ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle action={<Button size="sm" onClick={() => setEaseRun((n) => n + 1)}><IconPlay size={14} />Rejouer</Button>}>
            Mouvement
          </SectionTitle>
          <div className="flex flex-col gap-3">
            {EASES.map(([v, n, d]) => (
              <div key={v} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3">
                <span className="text-[13px]">{n}</span>
                <span className="relative h-3 border-b border-line">
                  <span
                    key={easeRun}
                    className="absolute -bottom-[5px] w-2.5 h-2.5 rounded-full bg-sodium motion-safe:animate-[ffEaseDemo_var(--dur)_var(--ease)_both]"
                    style={{ "--ease": `var(${v})`, "--dur": d.includes("ms") ? d.replace(" ", "") : "4s" } as React.CSSProperties}
                  />
                </span>
                <span className="font-mono text-[11px] text-ink-3">{d}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Boutons ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Boutons</SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="signal" size="lg"><IconPlay size={15} />Démarrer la session</Button>
            <Button variant="ink">Enregistrer</Button>
            <Button variant="line">Autre ambiance</Button>
            <Button variant="quiet">Planifier</Button>
            <Button variant="danger">Terminer</Button>
            <Button variant="line" disabled>Indisponible</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Ajouter"><IconPlus /></IconButton>
            <IconButton label="Tâches" active><IconTasks /></IconButton>
            <IconButton label="Marquer une distraction" kbd="D"><IconStone /></IconButton>
            <IconButton label="Timer flottant"><IconPip /></IconButton>
            <IconButton label="Aide"><IconHelp /></IconButton>
            <IconButton label="Plus d'actions" size="sm"><IconMore size={16} /></IconButton>
            <IconButton label="Fermer" size="sm"><IconClose size={16} /></IconButton>
          </div>
        </section>

        {/* ── Champs et sous-navigation ─────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-10">
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Champs</SectionTitle>
            <Field label="Nouvelle tâche" placeholder="Relire le chapitre 4" />
            <Field label="Durée de focus" type="number" defaultValue={25} unit="min" hint="Entre 5 et 120 minutes." />
            <Field label="Lien YouTube" defaultValue="youtube.com/watch?v=" error="Ce lien ne contient pas d'identifiant de vidéo." />
          </div>
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Sous-navigation</SectionTitle>
            <Segmented
              label="Sources"
              value={tab}
              onChange={setTab}
              items={[
                { id: "a", label: "Catalogue", count: 55 },
                { id: "b", label: "Spotify", brand: "#1db954" },
                { id: "c", label: "Twitch", brand: "#9146ff" },
              ]}
            />
            <Segmented
              size="sm"
              label="Activité"
              value={tab}
              onChange={setTab}
              items={[{ id: "a", label: "Aperçu" }, { id: "b", label: "Statistiques" }, { id: "c", label: "Wrapped" }]}
            />
          </div>
        </section>

        {/* ── La colonne ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle measure="primitive centrale">La colonne</SectionTitle>
          <div className="flex flex-wrap items-end gap-10">
            <Gauge label="Pomodoro" valueText={`${Math.round(level * 25)} min sur 25`} value={level} pulse={pulse} length={200} />
            <Gauge label="Objectif du jour" valueText="95 min sur 120" value={0.79} mark={0.66} markLabel="objectif 80 min" length={200} reflet />
            <Gauge label="Flowtime" valueText="3 vases pleins" value={0.3} laps={3} length={200} ticks={20} majorEvery={5} />
            <div className="flex flex-col gap-3 flex-1 min-w-64">
              <Gauge orientation="horizontal" label="Progression" valueText="61 %" value={level} length={320} thickness={6} ticks={25} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPulse({ kind: "blink", key: Date.now() })}>Clignement (piste suivante)</Button>
                <Button size="sm" onClick={() => setPulse({ kind: "buzz", key: Date.now() })}>Grésillement (distraction)</Button>
                <Button size="sm" onClick={() => setLevel((l) => (l >= 0.96 ? 0.04 : l + 0.08))}>Une graduation</Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── La ruelle (WebGL) ──────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionTitle measure="three.js · modélisée en code">La ruelle</SectionTitle>
          <CityScene
            ref={city}
            phase={halte ? "break" : "work"}
            board={halte ? "HALTE" : `${mins} MIN`}
            friends={friends}
            label={halte ? "La halte : les enseignes sont éteintes" : `La ruelle, ${mins} minutes restantes`}
            className="h-[380px] sm:h-[480px] rounded-[var(--r-surface)]"
          />
          <div className="flex flex-wrap gap-2" data-city-controls>
            <Button size="sm" onClick={() => setHalte((h) => !h)}>{halte ? "Reprise" : "Fin de pomodoro"}</Button>
            <Button size="sm" onClick={() => city.current?.flicker()}>Distraction</Button>
            <Button size="sm" onClick={() => city.current?.extend()}>Playlist prolongée</Button>
            <Button size="sm" onClick={() => city.current?.goal()}>Objectif atteint</Button>
            <Button size="sm" onClick={() => setMins((m) => (m <= 1 ? 25 : m - 1))}>Une minute</Button>
            <Button size="sm" onClick={() => setFriends((f) => (f >= 9 ? 0 : f + 3))}>Amis en focus : {friends}</Button>
          </div>
        </section>

        {/* ── Médias ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionTitle measure={`${defaultVideos.length} vidéos`}>Cartes média</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-8">
            {vids.map((v, i) => (
              <MediaCard
                key={v.id}
                thumb={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                title={v.title}
                subtitle={v.channel}
                meta={v.channel}
                color={getVideoColor(v)}
                selected={i === 0}
                kind={i === 2 ? "Playlist" : undefined}
                actions={<IconButton label="Ajouter" size="sm"><IconPlus size={16} /></IconButton>}
              />
            ))}
          </div>
        </section>

        {/* ── Pistes et contrôles ────────────────────────────────── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
          <div className="flex flex-col gap-3">
            <SectionTitle as="h3" measure="4 titres">Rangées de piste</SectionTitle>
            <div className="flex flex-col">
              <TrackRow index={1} title="Study With Me · Rainy crossing at night" subtitle="Abao in Tokyo" duration="1:02:14" state="played" />
              <TrackRow index={2} title="Midnight canal" subtitle="study with japan" duration="4:00:12" state="playing" />
              <TrackRow index={3} title="Dawn drive" subtitle="Abao Vision" duration="58:40" />
              <TrackRow index={4} title="Downtown night drive" subtitle="Seoul Walker" duration="3:12" suggestion
                actions={<IconButton label="Retirer cette suggestion" size="sm"><IconClose size={14} /></IconButton>} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Contrôles de lecture</SectionTitle>
            <div className="rounded-[var(--r-surface)] bg-[oklch(0.16_0.02_248)] p-3 flex flex-col gap-3">
              <span className="font-mono text-[11px] text-[oklch(0.92_0.01_85/0.6)]">YouTube, Spotify</span>
              <PlayerControls caps={{ skip: true, shuffle: true, loop: true }} shuffle={shuffle} loop={loop}
                onPrev={() => {}} onNext={() => {}} onShuffle={() => setShuffle((s) => !s)} onLoop={() => setLoop((l) => !l)} />
              <span className="font-mono text-[11px] text-[oklch(0.92_0.01_85/0.6)]">Twitch live</span>
              <PlayerControls caps={{ skip: false, shuffle: false, loop: false, reason: "indisponible sur un live" }}
                shuffle={false} loop={false} onPrev={() => {}} onNext={() => {}} onShuffle={() => {}} onLoop={() => {}} />
            </div>
          </div>
        </section>

        {/* ── Retours, modales, états ────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-10">
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Toasts et modale</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => toast({ title: "La file se prolonge", description: "8 titres proches de ta playlist.", accent: "emerald" })}>Toast info</Button>
              <Button size="sm" onClick={() => toast({ title: "Mix YouTube indisponible", description: "Lecture de la vidéo de départ en boucle.", accent: "amber" })}>Toast alerte</Button>
              <Button size="sm" onClick={() => setModal(true)}>Ouvrir une modale</Button>
            </div>
            <Modal open={modal} onClose={() => setModal(false)} title="Ajouter une playlist" meta="YouTube"
              footer={<><Button variant="quiet" onClick={() => setModal(false)}>Annuler</Button><Button variant="ink" onClick={() => setModal(false)}>Ajouter</Button></>}>
              <Field label="Lien de la playlist" placeholder="youtube.com/playlist?list=" />
            </Modal>
          </div>
          <div className="flex flex-col gap-4">
            <SectionTitle as="h3">Chargement</SectionTitle>
            <div className="grid grid-cols-[8rem_1fr] gap-4">
              <Skeleton className="aspect-video" />
              <Skeleton lines={3} />
            </div>
          </div>
        </section>
        <section>
          <EmptyState
            title="La file d'attente est vide."
            action={<Button variant="line"><IconPlus size={15} />Ajouter un titre</Button>}
          >
            Colle un lien YouTube : la file joue tes titres dans l&apos;ordre, et peut se prolonger avec des titres proches.
          </EmptyState>
        </section>
      </div>
    </main>
  );
}
