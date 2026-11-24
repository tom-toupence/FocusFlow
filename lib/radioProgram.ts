// Radio FocusFlow : le programme commun, construit UNIQUEMENT à partir du
// catalogue statique (data/videos.ts), et la logique de resynchronisation du
// lecteur (pure, testée). Aucune donnée locale (vidéos perso, historique,
// heure de chargement) n'entre dans le calcul : deux appareils au même instant
// obtiennent la même vidéo à la même seconde.
//
// Durées : le catalogue n'a pas (encore) de durées relevées et on n'en invente
// pas. Stratégie honnête :
//   . une vidéo sans `durationSec` est diffusée en extrait de
//     RADIO_SAFE_SEGMENT_SEC (30 min) À PARTIR DE 0. Le catalogue ne contient
//     que des « Study With Me » scéniques (titrés 1 h à 7 h quand la durée est
//     annoncée), des films lofi/paysage et des balades, en général d'une heure
//     ou plus : 30 min est une longueur sûre pour l'immense majorité ;
//   . si une vidéo se termine malgré tout plus tôt que prévu (ENDED avant la
//     fin du créneau), le lecteur passe à la piste suivante du programme, jouée
//     depuis son début, et retrouve le direct à la fin de celle-ci ;
//   . une durée renseignée plus tard dans data/videos.ts est prise en compte
//     (extrait choisi dans la vidéo par lib/radio.ts), pour tout le monde.
import { defaultVideos, type Video } from "@/data/videos";
import { createRadio, type Radio, type RadioSlot, type RadioTrack } from "@/lib/radio";
import { isActivelyFocusing, type FriendStats } from "@/lib/friends";

export const RADIO_NAME = "Radio FocusFlow";
/** Longueur d'extrait sûre pour une vidéo dont la durée n'est pas connue. */
export const RADIO_SAFE_SEGMENT_SEC = 30 * 60;

/** Pistes de la radio : le catalogue, durée inconnue = extrait sûr. */
export function radioTracksFrom(videos: readonly Video[]): RadioTrack[] {
  return videos
    .filter((v) => !v.custom)
    .map((v) => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      channel: v.channel,
      durationSec: v.durationSec && v.durationSec > 0 ? v.durationSec : RADIO_SAFE_SEGMENT_SEC,
    }));
}

export function buildRadio(videos: readonly Video[]): Radio {
  return createRadio(radioTracksFrom(videos), { maxSegmentSec: RADIO_SAFE_SEGMENT_SEC });
}

let shared: Radio | null = null;
/** Le programme de la radio (catalogue intégré uniquement). */
export function catalogueRadio(): Radio {
  return (shared ??= buildRadio(defaultVideos));
}

// ── Présence des amis ─────────────────────────────────────────────────────────

/** Activité publiée par /session quand la source est la radio. */
export const isRadioActivity = (activity: string | null | undefined): boolean =>
  !!activity && activity.includes(RADIO_NAME) && !activity.startsWith("En pause");

/**
 * Un ami écoute la radio : activité « radio » ET heartbeat de focus frais.
 * L'activité seule ne suffit pas : une fermeture brutale de l'onglet ne la
 * vide pas (le heartbeat de /session, lui, s'arrête).
 */
export const isListeningToRadio = (s: FriendStats | null | undefined, now: number): boolean =>
  !!s && isActivelyFocusing(s, now) && isRadioActivity(s.activity);

// ── Resynchronisation du lecteur ──────────────────────────────────────────────

/** Ce que le lecteur a appris pendant la session. */
export interface RadioCursor {
  /** IDs YouTube indisponibles (erreurs 100, 101, 150). */
  dead: Set<string>;
  /** Créneaux à ne plus jouer (fin prématurée, autre erreur). */
  skipped: Set<number>;
  /** Créneaux joués en avance (après un créneau sauté) : heure de départ réelle. */
  ahead: Map<number, number>;
}

export const newCursor = (dead: Set<string> = new Set()): RadioCursor => ({ dead, skipped: new Set(), ahead: new Map() });

export interface RadioTarget {
  slot: RadioSlot;
  /** Seconde de la vidéo où chercher. */
  offsetSec: number;
  /** Heure (ms) à laquelle se recaler sur le programme. */
  switchAt: number;
  /** Piste jouée avant son heure (créneau précédent inutilisable). */
  ahead: boolean;
}

const usable = (s: RadioSlot, c: RadioCursor) => !c.dead.has(s.track.youtubeId) && !c.dead.has(s.track.id) && !c.skipped.has(s.index);

/**
 * Ce que le lecteur doit jouer à `now`. Cas normal : la piste du programme à la
 * bonne seconde, jusqu'à la fin de son créneau. Si ce créneau est inutilisable,
 * la suivante disponible (skipUnavailable) depuis son début ; on retrouve le
 * direct à la fin de celle-ci. Mémorise le départ d'une piste jouée en avance
 * (une reprise après pause la continue au lieu de la recommencer).
 */
export function radioTarget(radio: Radio, now: number, cursor: RadioCursor): RadioTarget | null {
  const cur = radio.nowPlaying(now);
  if (!cur) return null;
  if (usable(cur, cursor)) return { slot: cur, offsetSec: cur.offsetSec, switchAt: cur.endsAt, ahead: false };
  let idx = cur.index;
  for (let i = 0; i < radio.size; i++) {
    const next = radio.skipUnavailable(idx, cursor.dead);
    if (!next) return null;
    idx = next.index;
    if (cursor.skipped.has(next.index)) continue;
    const started = cursor.ahead.get(next.index) ?? now;
    cursor.ahead.set(next.index, started);
    return { slot: next, offsetSec: next.segmentStartSec + Math.max(0, Math.floor((now - started) / 1000)), switchAt: next.endsAt, ahead: true };
  }
  return null;
}

/** Programme à afficher après le créneau `fromIndex`, sans les vidéos mortes. */
export function radioUpcoming(radio: Radio, fromIndex: number, n: number, dead: ReadonlySet<string> = new Set()): RadioSlot[] {
  const out: RadioSlot[] = [];
  for (let i = 1; out.length < n && i <= n + radio.size; i++) {
    const s = radio.slotAt(fromIndex + i);
    if (!s) break;
    if (!dead.has(s.track.youtubeId)) out.push(s);
  }
  return out;
}

/** « 21:45 » (heure locale). */
export function clockLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** « 18:02 » à partir de secondes (mm:ss, ou h:mm:ss au-delà d'une heure). */
export function durationLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${String(m).padStart(2, "0")}:${r}`;
}

/** IDs morts mémorisés pour la session de navigation (tous lecteurs confondus). */
export const sessionDeadIds = new Set<string>();
