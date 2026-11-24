// Lecture d'un flux iCalendar (RFC 5545) -> événements « occupés » d'un intervalle.
// Sans dépendance : fuseaux via Intl.DateTimeFormat, RRULE DAILY/WEEKLY.
import type { BusyEvent } from "./agendaFit";

export const ICS_MAX_EVENTS = 5000;
export const ICS_HORIZON_MS = 2 * 24 * 3600_000;
const DAY = 86_400_000;
const MAX_DAY_ITER = 20_000;

export interface IcsReadOptions {
  /** Fuseau des dates « flottantes » (défaut : fuseau du système). */
  timeZone?: string;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

// --- Fuseaux -----------------------------------------------------------------

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function tzOffsetMs(epoch: number, tz: string): number {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    fmtCache.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(epoch))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/** Heure murale d'un fuseau (exprimée comme un epoch « UTC ») -> vrai epoch. */
export function zonedToEpoch(wall: number, tz: string): number {
  let g = wall - tzOffsetMs(wall, tz);
  g = wall - tzOffsetMs(g, tz);
  return g;
}

const localToEpoch = (wall: number): number => {
  const d = new Date(wall);
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  ).getTime();
};

type Conv = (wall: number) => number;

function convFor(tz: string | undefined, fallback: Conv): Conv {
  if (!tz) return fallback;
  try {
    tzOffsetMs(0, tz); // valide le nom
    return (w) => zonedToEpoch(w, tz);
  } catch {
    return fallback; // TZID inconnu (noms Windows...)
  }
}

// --- Analyse des lignes ------------------------------------------------------

function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function splitOutsideQuotes(s: string, sep: string, once = false): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') q = !q;
    if (c === sep && !q && !(once && out.length >= 1)) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseLine(line: string): Prop | null {
  const [left, ...rest] = splitOutsideQuotes(line, ":", true);
  if (!rest.length) return null;
  const [name, ...ps] = splitOutsideQuotes(left, ";");
  const params: Record<string, string> = {};
  for (const p of ps) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: rest.join(":") };
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

interface DateVal {
  allDay: boolean;
  wall: number;
  conv: Conv;
}

function parseDate(value: string, params: Record<string, string>, floating: Conv): DateVal | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  if (params.VALUE === "DATE" || m[4] === undefined) return { allDay: true, wall, conv: (w) => w };
  if (m[7]) return { allDay: false, wall, conv: (w) => w };
  return { allDay: false, wall, conv: convFor(params.TZID, floating) };
}

function parseDuration(v: string): number | null {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms =
    ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 * 3600 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

// --- RRULE -------------------------------------------------------------------

interface Rule {
  freq: "DAILY" | "WEEKLY";
  interval: number;
  count?: number;
  until?: string;
  byday?: number[];
}

const DAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRule(v: string): Rule | null {
  const kv: Record<string, string> = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val) kv[k.toUpperCase()] = val;
  }
  if (kv.FREQ !== "DAILY" && kv.FREQ !== "WEEKLY") return null;
  const byday = kv.BYDAY
    ? kv.BYDAY.split(",")
        .map((d) => DAYS[d.replace(/^[+-]?\d+/, "").toUpperCase()])
        .filter((d) => d !== undefined)
    : undefined;
  return {
    freq: kv.FREQ,
    interval: Math.max(1, parseInt(kv.INTERVAL ?? "1", 10) || 1),
    count: kv.COUNT ? parseInt(kv.COUNT, 10) : undefined,
    until: kv.UNTIL,
    byday,
  };
}

const dayNum = (wall: number) => Math.floor(wall / DAY);
const weekday = (dn: number) => (((dn + 4) % 7) + 7) % 7; // 0 = dimanche

/** Débuts (epoch) des occurrences qui chevauchent potentiellement [from, to]. */
function expand(
  start: DateVal,
  durMs: number,
  rule: Rule,
  excluded: Set<number>,
  excludedDays: Set<number>,
  from: number,
  to: number,
  floating: Conv,
): number[] {
  const out: number[] = [];
  const conv = start.conv;
  const sDay = dayNum(start.wall);
  const tod = start.wall - sDay * DAY;
  const wd0 = weekday(sDay);
  const byday = rule.byday ?? (rule.freq === "WEEKLY" ? [wd0] : undefined);
  // semaine commençant le lundi (WKST=MO par défaut)
  const weekStart = sDay - ((wd0 + 6) % 7);
  let untilEpoch = Infinity;
  if (rule.until) {
    const u = parseDate(rule.until, {}, floating);
    if (u) untilEpoch = u.allDay ? conv(u.wall + DAY - 1) : u.conv(u.wall);
  }

  // Saut en avant s'il n'y a pas de COUNT (l'énumération depuis le début n'est pas requise).
  let n0 = 0;
  if (rule.count === undefined) {
    const approx = dayNum(from - durMs - DAY);
    n0 = Math.max(0, approx - sDay - 8 * rule.interval - 7);
    if (rule.freq === "WEEKLY") n0 = Math.max(0, n0 - ((n0 + (sDay - weekStart)) % (7 * rule.interval)));
  }

  let count = 0;
  let iter = 0;
  for (let n = n0; iter < MAX_DAY_ITER; n++, iter++) {
    const dn = sDay + n;
    let ok: boolean;
    if (rule.freq === "DAILY") ok = n % rule.interval === 0 && (!byday || byday.includes(weekday(dn)));
    else {
      const wi = Math.floor((dn - weekStart) / 7);
      ok = wi % rule.interval === 0 && byday!.includes(weekday(dn));
    }
    if (!ok) {
      if (conv(dn * DAY) > to + DAY && iter > 400) break;
      continue;
    }
    const wall = dn * DAY + tod;
    if (wall < start.wall) continue;
    const s = conv(wall);
    if (s > untilEpoch) break;
    count++;
    if (rule.count !== undefined && count > rule.count) break;
    if (s >= to) break;
    if (excluded.has(s) || excludedDays.has(dn)) continue;
    if (s + durMs > from) out.push(s);
  }
  return out;
}

// --- API ---------------------------------------------------------------------

/**
 * Événements occupés qui chevauchent [from, to] (to borné à from + 2 jours).
 * Ignore : journées entières, TRANSP:TRANSPARENT, STATUS:CANCELLED, durée nulle.
 * RRULE : DAILY/WEEKLY seulement (autres fréquences : première occurrence seule).
 */
export function parseIcsBusy(text: string, from: number, to: number, opts: IcsReadOptions = {}): BusyEvent[] {
  const horizon = Math.min(to, from + ICS_HORIZON_MS);
  const floating = convFor(opts.timeZone, localToEpoch);
  const lines = unfold(text);

  // 1) découpe en VEVENT
  const events: Prop[][] = [];
  let cur: Prop[] | null = null;
  for (const line of lines) {
    if (!line) continue;
    const up = line.toUpperCase();
    if (up === "BEGIN:VEVENT") cur = [];
    else if (up === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      if (events.length >= ICS_MAX_EVENTS) break;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }

  // 2) instances modifiées (RECURRENCE-ID) : on retire l'occurrence d'origine du maître
  const overridden = new Map<string, Set<number>>();
  for (const props of events) {
    const rid = props.find((p) => p.name === "RECURRENCE-ID");
    const uid = props.find((p) => p.name === "UID")?.value;
    if (!rid || !uid) continue;
    const d = parseDate(rid.value, rid.params, floating);
    if (!d) continue;
    if (!overridden.has(uid)) overridden.set(uid, new Set());
    overridden.get(uid)!.add(d.conv(d.wall));
  }

  const out: BusyEvent[] = [];
  for (const props of events) {
    const get = (n: string) => props.find((p) => p.name === n);
    if (get("STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    if (get("TRANSP")?.value.toUpperCase() === "TRANSPARENT") continue;
    const ds = get("DTSTART");
    if (!ds) continue;
    const start = parseDate(ds.value, ds.params, floating);
    if (!start || start.allDay) continue;
    const startEpoch = start.conv(start.wall);

    let durMs: number | null = null;
    const de = get("DTEND");
    if (de) {
      const e = parseDate(de.value, de.params, floating);
      if (e && !e.allDay) durMs = e.conv(e.wall) - startEpoch;
    } else {
      const d = get("DURATION");
      if (d) durMs = parseDuration(d.value);
    }
    if (durMs === null || durMs <= 0) continue;

    const title = get("SUMMARY") ? unescapeText(get("SUMMARY")!.value) : undefined;
    const push = (s: number) => {
      if (s < horizon && s + durMs! > from && out.length < ICS_MAX_EVENTS) {
        out.push(title !== undefined ? { start: s, end: s + durMs!, title } : { start: s, end: s + durMs! });
      }
    };

    const rr = get("RRULE");
    const rule = rr ? parseRule(rr.value) : null;
    if (!rule) {
      push(startEpoch);
      continue;
    }
    const excluded = new Set<number>(overridden.get(get("UID")?.value ?? "") ?? []);
    const excludedDays = new Set<number>();
    for (const ex of props.filter((p) => p.name === "EXDATE")) {
      for (const v of ex.value.split(",")) {
        const d = parseDate(v, ex.params, floating);
        if (!d) continue;
        if (d.allDay) excludedDays.add(dayNum(d.wall));
        else excluded.add(d.conv(d.wall));
      }
    }
    for (const s of expand(start, durMs, rule, excluded, excludedDays, from, horizon, floating)) push(s);
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}
