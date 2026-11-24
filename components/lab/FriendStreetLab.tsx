"use client";
// Banc d'essai de « Ta rue » : amis simulés, boutons pour changer l'état de
// chacun. ?full = toute la façade (sans l'écran de pause par-dessus).
import { useEffect, useState } from "react";
import FriendStreet from "@/components/FriendStreet";
import FriendWindowsList from "@/components/FriendWindowsList";
import { fakeFriends, fakeStats, type FakeState } from "@/components/lab/fakeFriends";
import { friendWindowState } from "@/lib/rue/friendWindows";
import { useFriendsStore } from "@/store/friendsStore";

const NEXT: Record<FakeState, FakeState> = { focus: "on", on: "off", off: "focus" };
const LABEL: Record<FakeState, string> = { focus: "en focus", on: "en ligne", off: "hors ligne" };
const ACTIVITY: Record<FakeState, string | null> = { focus: "En focus · Rain on the window", on: "En pause", off: null };

export default function FriendStreetLab() {
  const friends = useFriendsStore((s) => s.friends);
  const [full, setFull] = useState(false);
  const [panel, setPanel] = useState(true);
  useEffect(() => {
    useFriendsStore.setState({ friends: fakeFriends() });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFull(new URLSearchParams(window.location.search).has("full"));
    return () => useFriendsStore.setState({ friends: [] });
  }, []);

  const setState = (userId: string, st: FakeState) =>
    useFriendsStore.setState((s) => ({ friends: s.friends.map((f) => (f.userId === userId ? { ...f, stats: fakeStats(st, ACTIVITY[st]) } : f)) }));

  return (
    <main className="fixed inset-0 bg-[#07090d] text-white">
      <FriendStreet layout={full ? "full" : "pause"} className="absolute inset-0" label="Ta rue : une façade de nuit, tes amis sont les fenêtres." />
      {!full && (
        <>
          <div className="absolute inset-0 flex items-end md:items-center px-5 sm:px-10 lg:px-16 py-8 pointer-events-none">
            <div data-pause-text className="max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-focus">Pause courte</p>
              <h1 className="mt-2 font-semibold tracking-tight text-[clamp(2.75rem,7vw,5rem)] leading-[0.95]">Pause</h1>
              <p className="mt-3 text-[15px] text-white/75">Pomodoro 2 terminé. Lève les yeux de l&apos;écran.</p>
              <p className="mt-6 font-mono tabular-nums text-[clamp(4.5rem,12vw,7.5rem)] leading-none text-focus">04:12</p>
            </div>
          </div>
        </>
      )}
      <FriendWindowsList defaultOpen={false} className="absolute z-20 top-3 right-3 md:top-5 md:right-5" />

      <div className="absolute top-3 left-3 z-30 text-xs">
        <button onClick={() => setPanel((v) => !v)} className="px-2 py-1 rounded bg-black/60 border border-white/15">
          {panel ? "Masquer les réglages" : "Réglages"}
        </button>
        {panel && (
          <div className="mt-2 w-64 max-h-[70vh] overflow-y-auto p-3 rounded bg-black/80 border border-white/10 space-y-2">
            <p className="text-white/60">Lab : Ta rue. Clique un ami pour changer son état.</p>
            <button onClick={() => setFull((v) => !v)} className="w-full py-1 rounded border border-white/20">
              {full ? "Voir l'écran de pause" : "Voir toute la façade"}
            </button>
            {friends.map((f) => {
              const st = friendWindowState(f.stats);
              return (
                <button key={f.userId} data-testid={`toggle-${f.userId}`} onClick={() => setState(f.userId, NEXT[st])} className="flex w-full justify-between py-1 px-2 rounded border border-white/15 hover:border-white/40">
                  <span>{f.displayName}</span><span className="text-white/55">{LABEL[st]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
