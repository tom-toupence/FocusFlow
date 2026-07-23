"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, signInWithGoogle } from "@/lib/supabase";
import { useProfileStore, resolvedProfile } from "@/store/profileStore";
import { useFriendsStore, computeMyAggregate } from "@/store/friendsStore";
import { sendFriendRequest, acceptRequest, removeFriendship, isActivelyFocusing, SendResult } from "@/lib/friends";
import SubTabs from "@/components/SubTabs";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type SortKey = "minutes" | "sessions" | "streak";

const SORT_TABS: { id: SortKey; label: string }[] = [
  { id: "minutes", label: "Minutes" },
  { id: "sessions", label: "Pomodoros" },
  { id: "streak", label: "Série" },
];

const SEND_MESSAGES: Record<SendResult, { title: string; accent: "emerald" | "amber" | "violet" }> = {
  sent: { title: "Demande envoyée ✦", accent: "emerald" },
  accepted: { title: "Vous êtes amis 🎉", accent: "emerald" },
  already_friends: { title: "Vous êtes déjà amis", accent: "violet" },
  already_pending: { title: "Demande déjà en attente", accent: "amber" },
  invalid_code: { title: "Code invalide", accent: "amber" },
  cannot_add_self: { title: "C'est ton propre code 🙂", accent: "amber" },
  error: { title: "Erreur — réessaie", accent: "amber" },
};

function Avatar({ url, name, size = 36, focusing = false }: { url: string | null; name: string; size?: number; focusing?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-xs font-semibold text-foreground/60">{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {focusing && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" title="En focus" />
      )}
    </div>
  );
}

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m > 0 ? `${m}` : ""}`.trim() : `${m} min`;
}

export default function FriendsPanel() {
  // Monté uniquement à l'ouverture du tiroir (post-hydratation) → pas de garde
  // `mounted` nécessaire pour les stores persistés.
  const email = useProfileStore((s) => s.googleEmail);
  const profileState = useProfileStore();
  const me = resolvedProfile(profileState);
  const { friends, pending, myInvite, refresh } = useFriendsStore();
  const [sort, setSort] = useState<SortKey>("minutes");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  // Horloge qui tick (30 s) → « en focus depuis N min » vivant + péremption du
  // statut, sans appeler Date.now() pendant le render (règle react-hooks/purity).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { if (email) refresh(); }, [email, refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Leaderboard = moi + mes amis, trié par le critère choisi.
  const myAgg = useMemo(() => computeMyAggregate(), [friends, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaderboard = useMemo(() => {
    const rows = [
      ...(myAgg ? [{ id: "me", name: me.displayName, avatar: me.avatarUrl, isMe: true, focusing: false,
        minutes: myAgg.weekMinutes, sessions: myAgg.weekSessions, streak: myAgg.streak, level: myAgg.level, badges: myAgg.badges }] : []),
      ...friends.map((f) => ({
        id: f.userId, name: f.displayName, avatar: f.avatarUrl, isMe: false, focusing: isActivelyFocusing(f.stats, now),
        minutes: f.stats?.weekMinutes ?? 0, sessions: f.stats?.weekSessions ?? 0, streak: f.stats?.streak ?? 0,
        level: f.stats?.level ?? 1, badges: f.stats?.badges ?? 0,
      })),
    ];
    return rows.sort((a, b) => b[sort] - a[sort]);
  }, [myAgg, friends, sort, me.displayName, me.avatarUrl, now]);

  const focusingFriends = friends.filter((f) => isActivelyFocusing(f.stats, now));

  // ── Garde-fous online-only ────────────────────────────────────────────────
  if (!supabase) {
    return (
      <EmptyState
        title="Les amis nécessitent la synchronisation"
        text="Cette version fonctionne en local uniquement. Configure Supabase pour activer les comptes et les amis."
      />
    );
  }
  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
            <svg className="w-7 h-7 text-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Connecte-toi pour retrouver tes amis</p>
            <p className="text-xs text-foreground/40 mt-1 max-w-xs">Compare vos sessions de focus de la semaine et vois qui travaille en ce moment.</p>
          </div>
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12 11v2h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.6 2.7 14.5 1.8 12 1.8 6.5 1.8 2 6.3 2 11.8s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.7z"/></svg>
            Continuer avec Google
          </button>
      </div>
    );
  }

  const handleAdd = async () => {
    const c = code.trim();
    if (!c || sending) return;
    setSending(true);
    const result = await sendFriendRequest(c);
    setSending(false);
    const m = SEND_MESSAGES[result];
    toast({ title: m.title, emoji: "👥", accent: m.accent });
    if (result === "sent" || result === "accepted") { setCode(""); refresh(); }
  };

  const copyLink = () => {
    if (!myInvite) return;
    const link = `${window.location.origin}/?add=${myInvite.inviteCode}`;
    navigator.clipboard?.writeText(link);
    toast({ title: "Lien d'invitation copié", description: "Partage-le pour ajouter un ami.", emoji: "🔗", accent: "emerald" });
  };

  return (
      <div className="flex flex-col gap-8">
        {/* En focus maintenant */}
        {focusingFriends.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En focus maintenant
            </p>
            <div className="flex flex-wrap gap-2">
              {focusingFriends.map((f) => {
                const since = Math.max(1, Math.round((now - (f.stats?.focusStartedAt ?? now)) / 60000));
                return (
                  <div key={f.userId} className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Avatar url={f.avatarUrl} name={f.displayName} size={28} />
                    <div className="leading-tight">
                      <p className="text-xs font-medium text-foreground">{f.displayName}</p>
                      <p className="text-[10px] text-emerald-500 dark:text-emerald-400">en focus depuis {since} min</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Classement de la semaine */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest">Classement de la semaine</p>
            <SubTabs tabs={SORT_TABS} active={sort} onSelect={setSort} />
          </div>
          {leaderboard.length <= 1 ? (
            <p className="text-sm text-foreground/35 py-4">Ajoute des amis pour comparer vos semaines de focus 👇</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {leaderboard.map((r, i) => (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                    r.isMe ? "bg-foreground/[0.06] border-foreground/15" : "bg-foreground/[0.02] border-foreground/[0.06]"
                  )}
                >
                  <span className={cn("w-5 text-center text-sm font-bold tabular-nums flex-shrink-0",
                    i === 0 ? "text-amber-400" : i === 1 ? "text-foreground/50" : i === 2 ? "text-orange-400/70" : "text-foreground/25")}>
                    {i + 1}
                  </span>
                  <Avatar url={r.avatar} name={r.name} size={34} focusing={r.focusing} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.name}{r.isMe && <span className="text-foreground/40 font-normal"> (toi)</span>}
                    </p>
                    <p className="text-[11px] text-foreground/40">Niv. {r.level} · {r.badges} badge{r.badges > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {sort === "minutes" ? fmtMin(r.minutes) : sort === "sessions" ? r.sessions : `${r.streak} j`}
                    </p>
                    <p className="text-[10px] text-foreground/30">
                      {sort === "minutes" ? "cette semaine" : sort === "sessions" ? "pomodoros" : "de série"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Demandes reçues */}
        {pending.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">Demandes reçues</p>
            <div className="flex flex-col gap-1.5">
              {pending.map((p) => (
                <div key={p.friendshipId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08]">
                  <Avatar url={p.avatarUrl} name={p.displayName} size={34} />
                  <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{p.displayName}</p>
                  <button
                    onClick={async () => { if (await acceptRequest(p.friendshipId)) { toast({ title: "Ami ajouté 🎉", accent: "emerald" }); refresh(); } }}
                    className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={async () => { if (await removeFriendship(p.friendshipId)) refresh(); }}
                    className="px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 text-xs font-medium transition-all"
                  >
                    Refuser
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ajouter un ami + mon code */}
        <section className="rounded-2xl bg-foreground/[0.03] border border-foreground/[0.08] p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ajouter un ami</h3>
            <p className="text-xs text-foreground/40 mt-0.5">Colle son code, ou partage le tien.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Code d'invitation d'un ami…"
              className="flex-1 min-w-0 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 transition-colors uppercase"
            />
            <button
              onClick={handleAdd}
              disabled={!code.trim() || sending}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold disabled:opacity-30 transition-all flex-shrink-0"
            >
              Ajouter
            </button>
          </div>

          {myInvite && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/[0.04] border border-foreground/10">
                <span className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider flex-shrink-0">Mon code</span>
                <span className="text-sm font-mono font-semibold text-foreground tracking-wider truncate">{myInvite.inviteCode}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground text-xs font-medium transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copier le lien
              </button>
            </div>
          )}
        </section>

        {/* Mes amis */}
        {friends.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">Mes amis · {friends.length}</p>
            <div className="flex flex-col gap-1">
              {friends.map((f) => (
                <div key={f.userId} className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-foreground/[0.03] transition-colors">
                  <Avatar url={f.avatarUrl} name={f.displayName} size={32} focusing={isActivelyFocusing(f.stats)} />
                  <p className="flex-1 min-w-0 text-sm text-foreground/85 truncate">{f.displayName}</p>
                  <button
                    onClick={async () => { if (await removeFriendship(f.friendshipId)) { toast({ title: "Ami retiré", accent: "amber" }); refresh(); } }}
                    className="sm:opacity-0 sm:group-hover:opacity-100 text-foreground/40 sm:text-foreground/25 hover:text-red-400 transition-all p-1.5 -m-1 flex-shrink-0"
                    title="Retirer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center text-foreground/40">
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs max-w-xs">{text}</p>
    </div>
  );
}
