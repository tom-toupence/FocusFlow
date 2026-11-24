"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { create } from "zustand";
import { useRouter } from "next/navigation";
import { useNavStore, NavSection, MediaSource, OrgTab, ActivityTab } from "@/store/navStore";
import { useFriendsDrawer } from "@/store/friendsDrawerStore";
import { useTimerStore } from "@/store/timerStore";
import { cn } from "@/lib/utils";
import { parseQuickLaunch, type QuickLaunch, type QuickPreset } from "@/lib/quickLaunch";
import { resolveLaunch, provenanceOf, PRESET_LABEL, type LaunchContext, type LaunchMedia, type LaunchPlan } from "@/lib/launchPlan";
import { buildQuickContext, launchFromQuick, RELAUNCH_LAST } from "@/lib/launch";
import { PRESETS } from "@/store/timerStore";

// État d'ouverture partagé : ⌘K (clavier) + bouton header peuvent tous deux l'ouvrir.
export const useCommandPalette = create<{ open: boolean; setOpen: (v: boolean) => void; toggle: () => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

// --- Lancer en une phrase ------------------------------------------------------

type PillId = "duration" | "todo" | "media";
const PILLS: PillId[] = ["duration", "todo", "media"];

/** Corrections faites par Tab sur les pastilles (undefined : rien de touché). */
interface Overrides {
  duration?: { minutes?: number; preset?: QuickPreset } | "current";
  todo?: string | null;
  media?: string | null;
}

function applyOverrides(r: QuickLaunch, o: Overrides): QuickLaunch {
  const e: QuickLaunch = { ...r };
  const touched = o.duration !== undefined || o.todo !== undefined || o.media !== undefined;
  if (o.duration === "current") { e.minutes = undefined; e.preset = undefined; }
  else if (o.duration) { e.minutes = o.duration.minutes; e.preset = o.duration.preset; }
  if (o.todo !== undefined) { e.todoId = o.todo ?? undefined; e.todoAlternatives = undefined; }
  if (o.media !== undefined) {
    e.mediaKey = o.media ?? undefined;
    e.mediaAlternatives = undefined;
    e.url = undefined;
    e.youtubeId = undefined;
    e.source = undefined;
    if (e.intent === "relaunch-last") e.intent = "launch";
  }
  if (touched && (!e.intent || e.intent === "resume-session")) e.intent = "launch";
  return e;
}

/**
 * La phrase contient une durée, un lien, un preset ou un média : on montre ce
 * qui est compris même si une commande correspond. Un nom de source seul
 * (« spotify ») reste une commande de navigation.
 */
const isStrong = (r: QuickLaunch) =>
  r.minutes !== undefined || !!r.url || !!r.preset || !!r.mediaKey || !!r.mediaAlternatives || r.intent === "relaunch-last" ||
  (!!r.source && (!!r.todoId || !!r.todoAlternatives));

interface Option { id: string; label: string; hint?: string; apply: Overrides }

type Row =
  | { id: string; kind: "choice"; group: "media" | "todo"; label: string; hint?: string; run: () => void }
  | { id: string; kind: "launch"; label: string; run: () => void }
  | { id: string; kind: "command"; label: string; hint?: string; run: () => void };

export default function CommandPalette() {
  const { open, setOpen, toggle } = useCommandPalette();

  // Ouverture par ⌘K / Ctrl+K (et fermeture par Échap)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setOpen]);

  if (!open) return null;
  // Monté seulement à l'ouverture → query/index repartent à zéro sans effet de reset.
  return <PaletteDialog onClose={() => setOpen(false)} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [ctx] = useState<LaunchContext>(() => buildQuickContext());
  const [overrides, setOverrides] = useState<Overrides>({});
  const [editing, setEditing] = useState<PillId | null>(null);
  const [optIndex, setOptIndex] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const goSection = (s: NavSection) => () => { useNavStore.getState().setSection(s); router.push("/"); onClose(); };
  const goMedia = (m: MediaSource) => () => { useNavStore.getState().openMedia(m); router.push("/"); onClose(); };
  const goOrg = (t: OrgTab) => () => { useNavStore.getState().openOrg(t); router.push("/"); onClose(); };
  const goActivity = (t: ActivityTab) => () => { useNavStore.getState().openActivity(t); router.push("/"); onClose(); };
  const goRoute = (path: string) => () => { router.push(path); onClose(); };
  const create = (k: "project" | "sprint") => () => { useNavStore.getState().requestCreate(k); router.push("/"); onClose(); };
  const openFriends = () => { useFriendsDrawer.getState().setOpen(true); onClose(); };

  const launch = async (r: QuickLaunch) => {
    if (launching) return;
    setLaunching(true);
    setLaunchError(null);
    const out = await launchFromQuick(r, router, ctx);
    if (out.ok) onClose();
    else { setLaunchError(out.message); setLaunching(false); }
  };

  const sessionActive = useTimerStore((s) => s.active);
  const relaunchPlan = useMemo(() => resolveLaunch(RELAUNCH_LAST, ctx), [ctx]);

  const commands: Command[] = [
    ...(sessionActive
      ? [{ id: "return-session", label: "Retour à la session", hint: "Session en cours", keywords: "retour reprendre session en cours minuteur timer", run: goRoute("/session") }]
      : []),
    ...(relaunchPlan.launchable && relaunchPlan.media
      ? [{ id: "relaunch-last", label: "Relancer comme la dernière fois", hint: relaunchPlan.media.title, keywords: "relancer derniere fois comme hier avant habitude meme chose", run: () => void launch(RELAUNCH_LAST) }]
      : []),
    { id: "start", label: "Démarrer une session", hint: "Choisir une ambiance", keywords: "demarrer session focus pomodoro play lancer", run: goMedia("catalogue") },
    { id: "accueil", label: "Aujourd'hui", hint: "Tableau de bord", keywords: "accueil home dashboard aujourdhui", run: goSection("accueil") },
    { id: "ecouter", label: "Écouter", hint: "Catalogue & sources", keywords: "ecouter musique media son", run: goSection("ecouter") },
    { id: "catalogue", label: "Catalogue", hint: "Vidéos lofi/chill", keywords: "catalogue ambiance lofi videos", run: goMedia("catalogue") },
    { id: "library", label: "Ma bibliothèque", hint: "Vidéos, playlists & file", keywords: "bibliotheque library file queue playlist perso", run: goMedia("library") },
    { id: "discover", label: "Découvrir", hint: "Recommandations", keywords: "decouvrir discover recommandations suggestions recos", run: goMedia("discover") },
    { id: "spotify", label: "Spotify", keywords: "spotify musique premium", run: goMedia("spotify") },
    { id: "twitch", label: "Twitch", keywords: "twitch live stream vod", run: goMedia("twitch") },
    { id: "organisation", label: "Organisation", hint: "Projets, planning, routines", keywords: "organisation projets planning routines sprint journal", run: goSection("organisation") },
    { id: "projets", label: "Projets", hint: "Organisation", keywords: "projets deadlines budget pomodoros organisation", run: goOrg("projets") },
    { id: "planning", label: "Planning de la semaine", hint: "Organisation", keywords: "planning semaine time-blocking blocs organisation", run: goOrg("planning") },
    { id: "sprint", label: "Sprint", hint: "Organisation", keywords: "sprint deadline objectif organisation", run: goOrg("sprint") },
    { id: "routines", label: "Routines", hint: "Organisation", keywords: "routines sessions favorites organisation", run: goOrg("routines") },
    { id: "journal", label: "Journal", hint: "Organisation", keywords: "journal humeur reflexion organisation", run: goOrg("journal") },
    { id: "create-project", label: "Créer un projet", hint: "Formulaire prêt", keywords: "creer nouveau projet", run: create("project") },
    { id: "create-sprint", label: "Créer un sprint", hint: "Formulaire prêt", keywords: "creer nouveau sprint deadline", run: create("sprint") },
    { id: "create-playlist", label: "Créer une playlist", hint: "Depuis Ma bibliothèque", keywords: "creer nouvelle playlist locale musique", run: goMedia("library") },
    { id: "activite", label: "Activité", hint: "Stats & progression", keywords: "activite stats progression badges", run: goSection("activite") },
    { id: "stats", label: "Statistiques", hint: "Activité", keywords: "insights stats graphiques export activite", run: goActivity("stats") },
    { id: "wrapped-tab", label: "Wrapped", hint: "Activité", keywords: "wrapped recap semaine partage activite", run: goActivity("wrapped") },
    { id: "friends", label: "Amis", hint: "Panneau latéral", keywords: "amis friends leaderboard classement focus", run: openFriends },
    { id: "settings", label: "Réglages", hint: "Preset & tâches", keywords: "reglages settings preset taches kanban coach", run: goRoute("/settings") },
    { id: "insights", label: "Statistiques détaillées", keywords: "insights stats graphiques export", run: goRoute("/insights") },
    { id: "wrapped", label: "Récap hebdo", keywords: "wrapped recap semaine partage", run: goRoute("/wrapped") },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((c) => (c.label + " " + c.keywords).toLowerCase().includes(q)) : commands;

  // Ce que la phrase veut dire (analyse locale, lib/quickLaunch.ts)
  const parsed = useMemo(() => (query.trim() ? parseQuickLaunch(query, ctx) : null), [query, ctx]);
  const touched = overrides.duration !== undefined || overrides.todo !== undefined || overrides.media !== undefined;
  const effective = parsed ? applyOverrides(parsed, overrides) : null;
  const plan: LaunchPlan | null = effective?.intent ? resolveLaunch(effective, ctx) : null;
  const showCompris = !!plan && !!parsed && (filtered.length === 0 || isStrong(parsed) || touched);
  const confident = !!effective && (effective.confidence >= 0.6 || touched);

  const pickMedia = (key: string | null) => { setOverrides((o) => ({ ...o, media: key })); setIndex(0); setLaunchError(null); };
  const pickTodo = (id: string | null) => { setOverrides((o) => ({ ...o, todo: id })); setIndex(0); };
  const chooseOption = (o: Option) => {
    setOverrides((prev) => ({ ...prev, ...o.apply }));
    setIndex(0);
    setLaunchError(null);
    setEditing(null);
    inputRef.current?.focus();
  };

  const rows: Row[] = [];
  if (showCompris && plan) {
    for (const m of plan.mediaChoices) rows.push({ id: `m-${m.key}`, kind: "choice", group: "media", label: m.title, hint: provenanceOf(m), run: () => pickMedia(m.key) });
    for (const t of plan.todoChoices) rows.push({ id: `t-${t.id}`, kind: "choice", group: "todo", label: t.text, run: () => pickTodo(t.id) });
  }
  const launchRow: Row | null =
    showCompris && plan?.launchable && effective
      ? { id: "launch", kind: "launch", label: plan.intent === "resume-session" ? "Revenir" : confident ? "Démarrer" : "Démarrer quand même", run: () => void launch(effective) }
      : null;
  const commandRows: Row[] = filtered.map((c) => ({ id: c.id, kind: "command", label: c.label, hint: c.hint, run: c.run }));
  if (launchRow && confident) rows.push(launchRow);
  rows.push(...commandRows);
  if (launchRow && !confident) rows.push(launchRow);
  const safeIndex = rows.length ? Math.min(index, rows.length - 1) : 0;
  const selectedId = rows[safeIndex]?.id;

  // Options de la pastille en cours de modification (Tab)
  const options: Option[] = (() => {
    if (!editing || !plan) return [];
    if (editing === "duration") {
      const cur = ctx.env.timer;
      const list: Option[] = [
        { id: "classic", label: `${PRESETS.classic.workDuration} min, Classic`, apply: { duration: { preset: "classic" } } },
        { id: "deep", label: `${PRESETS.deep.workDuration} min, Deep`, apply: { duration: { preset: "deep" } } },
        { id: "flowtime", label: "Flowtime", hint: "Chrono libre", apply: { duration: { preset: "flowtime" } } },
        { id: "current", label: "Réglage actuel", hint: cur.preset === "flowtime" ? "Flowtime" : `${cur.workDuration} min, ${PRESET_LABEL[cur.preset]}`, apply: { duration: "current" } },
      ];
      if (parsed?.minutes !== undefined && ![PRESETS.classic.workDuration, PRESETS.deep.workDuration].includes(parsed.minutes)) {
        const m = parsed.minutes;
        list.unshift({ id: "typed", label: `${m} min`, hint: "Tapé", apply: { duration: { minutes: m } } });
      }
      return list;
    }
    if (editing === "todo") {
      const open = ctx.todos.filter((t) => t.status !== "done");
      const first = new Set(plan.todoChoices.map((t) => t.id));
      const sorted = [...open.filter((t) => first.has(t.id)), ...open.filter((t) => !first.has(t.id))];
      return [
        { id: "none", label: "Aucune tâche", apply: { todo: null } },
        ...sorted.map((t) => ({ id: t.id, label: t.text, hint: t.status === "in-progress" ? "En cours" : undefined, apply: { todo: t.id } })),
      ];
    }
    const first = plan.mediaChoices;
    const firstKeys = new Set(first.map((m) => m.key));
    const rest = [...ctx.media].filter((m) => !firstKeys.has(m.key)).sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, 40);
    return [
      ...first.map((m) => mediaOption(m)),
      { id: "keep", label: "Sélection actuelle", hint: ctx.env.currentMediaTitle, apply: { media: null } },
      ...rest.map((m) => mediaOption(m)),
    ];
  })();
  const safeOpt = options.length ? Math.min(optIndex, options.length - 1) : 0;

  const startEditing = (p: PillId | null) => { setEditing(p); setOptIndex(0); };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && showCompris && plan?.intent !== "resume-session") {
      e.preventDefault();
      const order: (PillId | null)[] = [null, ...PILLS];
      const at = order.indexOf(editing);
      startEditing(order[(at + (e.shiftKey ? order.length - 1 : 1)) % order.length]);
      return;
    }
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      e.stopPropagation();
      startEditing(null);
      return;
    }
    const n = editing ? options.length : rows.length;
    const cur = editing ? safeOpt : safeIndex;
    const set = editing ? setOptIndex : setIndex;
    if (e.key === "ArrowDown") { e.preventDefault(); set(Math.min(cur + 1, n - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); set(Math.max(cur - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (editing) { const o = options[safeOpt]; if (o) chooseOption(o); }
      else rows[safeIndex]?.run();
    }
  };

  const microLabel = "font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35";
  const choiceRows = rows.filter((r) => r.kind === "choice");

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] sm:pt-[15vh] px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Palette de commandes"
        className="w-full max-w-lg max-h-[84vh] flex flex-col bg-card border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-foreground/[0.08] flex-shrink-0">
          <svg className="w-4 h-4 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); setOverrides({}); setEditing(null); setLaunchError(null); }}
            onKeyDown={onListKey}
            placeholder="Une action, ou 50 min rapport lofi"
            aria-label="Rechercher une action ou décrire une session"
            className="flex-1 min-w-0 bg-transparent py-3.5 text-base sm:text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] text-foreground/30 border border-foreground/15 rounded px-1.5 py-0.5">Échap</kbd>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {showCompris && plan && (
            <motion.section
              aria-label="Compris"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn("px-4 pt-4 pb-3", commandRows.length > 0 && "border-b border-foreground/[0.08]")}
            >
              <p className={microLabel}>Compris</p>

              {plan.intent === "resume-session" ? (
                <p className="mt-2.5 text-sm text-foreground/80">Retour à la session en cours.</p>
              ) : (
                <>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <PillButton
                      label="Durée"
                      value={plan.timer.label}
                      dim={!plan.timerExplicit && overrides.duration === undefined}
                      active={editing === "duration"}
                      onClick={() => { startEditing(editing === "duration" ? null : "duration"); inputRef.current?.focus(); }}
                      reduce={!!reduce}
                    />
                    <PillButton
                      label="Tâche"
                      value={plan.todo ? plan.todo.text : plan.todoChoices.length ? "À choisir" : "Aucune"}
                      pending={plan.todoChoices.length > 0}
                      dim={!plan.todo && !plan.todoChoices.length}
                      active={editing === "todo"}
                      onClick={() => { startEditing(editing === "todo" ? null : "todo"); inputRef.current?.focus(); }}
                      reduce={!!reduce}
                    />
                    <PillButton
                      label="Musique"
                      value={plan.mediaChoices.length ? "À choisir" : plan.media?.title ?? "Aucune"}
                      pending={plan.mediaChoices.length > 0}
                      dim={!!plan.media && !plan.media.ref}
                      active={editing === "media"}
                      onClick={() => { startEditing(editing === "media" ? null : "media"); inputRef.current?.focus(); }}
                      reduce={!!reduce}
                    />
                  </div>

                  {!editing && plan.media && !plan.mediaChoices.length && plan.media.ref && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-2.5">
                      <div className="w-20 aspect-video rounded-lg overflow-hidden bg-foreground/10 flex-shrink-0 flex items-center justify-center">
                        {plan.media.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={plan.media.thumbnailUrl} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{plan.media.title}</p>
                        <p className="font-mono text-[11px] leading-snug text-foreground/45 line-clamp-2">
                          {[plan.media.subtitle, plan.media.provenance].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {editing ? (
                <div className="mt-3">
                  <p className={microLabel}>{editing === "duration" ? "Changer la durée" : editing === "todo" ? "Changer la tâche" : "Changer la musique"}</p>
                  <ul role="listbox" aria-label="Choix" className="mt-1.5 max-h-56 overflow-y-auto -mx-1">
                    {options.map((o, i) => (
                      <li key={o.id} role="option" aria-selected={i === safeOpt}>
                        <button
                          onClick={() => chooseOption(o)}
                          onMouseEnter={() => setOptIndex(i)}
                          className={cn("w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors", i === safeOpt ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
                        >
                          <span className="text-sm text-foreground/85 truncate">{o.label}</span>
                          {o.hint && <span className="font-mono text-[11px] text-foreground/40 flex-shrink-0 truncate max-w-[45%]">{o.hint}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : choiceRows.length > 0 ? (
                <div className="mt-3">
                  <p className={microLabel}>{choiceRows[0].kind === "choice" && choiceRows[0].group === "media" ? "Quelle musique ?" : "Quelle tâche ?"}</p>
                  <ul role="listbox" aria-label="Plusieurs correspondances" className="mt-1.5 -mx-1">
                    {choiceRows.map((r) => {
                      const i = rows.indexOf(r);
                      return (
                        <li key={r.id} role="option" aria-selected={r.id === selectedId}>
                          <button
                            onClick={r.run}
                            onMouseEnter={() => setIndex(i)}
                            className={cn("w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors", r.id === selectedId ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
                          >
                            <span className="text-sm text-foreground/85 truncate">{r.label}</span>
                            {r.kind === "choice" && r.hint && <span className="font-mono text-[11px] text-foreground/40 flex-shrink-0 truncate max-w-[45%]">{r.hint}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {(plan.error || launchError) && (
                <p role="alert" className="mt-3 text-xs text-red-500 dark:text-red-400">{launchError ?? plan.error}</p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] text-foreground/40">
                  {editing
                    ? "Entrée : choisir · Échap : retour"
                    : choiceRows.length
                    ? "Flèches et Entrée : choisir · Tab : modifier"
                    : plan.intent === "resume-session"
                    ? "Entrée : revenir"
                    : "Entrée : démarrer · Tab : modifier un élément"}
                </p>
                {launchRow && (
                  <button
                    onClick={launchRow.run}
                    onMouseEnter={() => setIndex(rows.indexOf(launchRow))}
                    disabled={launching}
                    className={cn(
                      "flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                      confident ? "bg-foreground text-background hover:bg-foreground/90" : "border border-foreground/20 text-foreground/80 hover:bg-foreground/[0.06]",
                      selectedId === "launch" && !editing && "ring-2 ring-focus ring-offset-2 ring-offset-card"
                    )}
                  >
                    {launching ? "Lancement…" : launchRow.label}
                  </button>
                )}
              </div>
            </motion.section>
          )}

          {(commandRows.length > 0 || !showCompris) && <div className="py-2">
            {showCompris && commandRows.length > 0 && <p className={cn(microLabel, "px-4 pt-1 pb-1.5")}>Actions</p>}
            {commandRows.length === 0 && !showCompris ? (
              <p className="px-4 py-6 text-sm text-foreground/30 text-center">Aucune action</p>
            ) : (
              commandRows.map((c) => {
                const i = rows.indexOf(c);
                return (
                  <button
                    key={c.id}
                    onClick={c.run}
                    onMouseEnter={() => setIndex(i)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                      c.id === selectedId && !editing ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
                    )}
                  >
                    <span className="text-sm text-foreground/85 truncate">{c.label}</span>
                    {c.kind === "command" && c.hint && <span className="text-xs text-foreground/35 flex-shrink-0 truncate max-w-[45%]">{c.hint}</span>}
                  </button>
                );
              })
            )}
          </div>}
        </div>

        <p className="flex-shrink-0 px-4 py-2.5 border-t border-foreground/[0.08] font-mono text-[11px] leading-relaxed text-foreground/35">
          Marche aussi : « 25 min maths », « deep spotify », un lien YouTube collé, « comme hier »
        </p>
      </div>
    </div>
  );
}

function mediaOption(m: LaunchMedia): Option {
  return { id: m.key, label: m.title, hint: provenanceOf(m), apply: { media: m.key } };
}

function PillButton({
  label, value, active, pending, dim, onClick, reduce,
}: { label: string; value: string; active: boolean; pending?: boolean; dim?: boolean; onClick: () => void; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      aria-pressed={active}
      className={cn(
        "max-w-full flex items-baseline gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors",
        active ? "border-focus bg-focus/[0.08]" : "border-foreground/15 hover:border-foreground/30"
      )}
    >
      <span className="text-foreground/45 flex-shrink-0">{label}</span>
      <span className={cn("truncate", pending ? "text-focus" : dim ? "text-foreground/55" : "text-foreground")}>{value}</span>
    </motion.button>
  );
}
