// Amis simulés des bancs d'essai (/lab/rue, /lab/amis), sans Supabase :
// 3 en focus, 2 en ligne, 3 hors ligne, avec leur activité.
import type { Friend, FriendStats } from "@/lib/friends";

export type FakeState = "focus" | "on" | "off";

const FAKE: [string, FakeState, string | null][] = [
  ["Léa Martin", "focus", "En focus · Kyoto Rain Lofi"],
  ["Tom", "focus", "Radio FocusFlow · Nuit calme"],
  ["Inès", "focus", "En focus · Spotify"],
  ["Hugo", "on", "En pause"],
  ["Maya", "on", null],
  ["Noé", "off", null],
  ["Sacha", "off", null],
  ["Jade", "off", null],
];

export function fakeStats(st: FakeState, activity: string | null, now = Date.now()): FriendStats {
  return {
    weekMinutes: 0, weekSessions: 0, streak: 0, level: 1, xp: 0, badges: 0,
    inFocus: st === "focus", focusStartedAt: now, focusHeartbeat: st === "focus" ? now : 0,
    online: st !== "off", onlineHeartbeat: st !== "off" ? now : 0, activity: st === "off" ? null : activity,
  };
}

export function fakeFriends(): Friend[] {
  const now = Date.now();
  return FAKE.map(([name, st, activity], i): Friend => ({
    friendshipId: `f${i}`, userId: `lab-ami-${i}`, username: name.toLowerCase(), displayName: name, avatarUrl: null,
    stats: fakeStats(st, activity, now),
  }));
}
