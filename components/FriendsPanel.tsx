"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, signInWithGoogle } from "@/lib/supabase";
import { useProfileStore, resolvedProfile } from "@/store/profileStore";
import { useFriendsStore, computeMyAggregate } from "@/store/friendsStore";
import {
  sendFriendRequest, acceptRequest, removeFriendship, isActivelyFocusing,
  ensureMyProfile, SendResult,
} from "@/lib/friends";
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

function Avatar({ url, name, size = 34, focusing = false }: { url: string | null; name: string; size?: number; focusing?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center ring-1 ring-foreground/[0.06]">
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
  if (min <= 0) return "0";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}` : `${m}m`;
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/35">{children}</span>
      {right}
    </div>
  );
}

export default function FriendsPanel() {
  const email = useProfileStore((s) => s.googleEmail);
  const profileState = useProfileStore();
  const me = resolvedProfile(profileState);
  const { friends, pending, myInvite, refresh, setMyInvite } = useFriendsStore();
  const [sort, setSort] = useState<SortKey>("minutes");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { if (email) refresh(); }, [email, refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Filet de sécurité : si l'identité publique n'a pas encore été générée
  // (ex. SQL fraîchement appliqué), on la (re)crée pour afficher le code.
  useEffect(() => {
    if (email && !myInvite) {
      ensureMyProfile(me.displayName, me.avatarUrl).then((inv) => { if (inv) setMyInvite(inv); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, myInvite]);

  const myAgg = useMemo(() => computeMyAggregate(), [friends, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaderboard = useMemo(() => {
    const rows = [
      { id: "me", name: me.displayName, avatar: me.avatarUrl, isMe: true, focusing: false,
        minutes: myAgg.weekMinutes, sessions: myAgg.weekSessions, streak: myAgg.streak, level: myAgg.level, badges: myAgg.badges },
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
    return <Empty title="Amis indisponibles" text="Cette version fonctionne en local. Configure Supabase pour activer les comptes et les amis." />;
  }
  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-2">
        <div className="w-14 h-14 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
          <UsersIcon className="w-7 h-7 text-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Connecte-toi pour tes amis</p>
          <p className="text-xs text-foreground/40 mt-1">Comparez vos semaines de focus et voyez qui travaille en direct.</p>
        </div>
        <button onClick={() => signInWithGoogle()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all">
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

  const copyCode = () => {
    if (!myInvite) return;
    navigator.clipboard?.writeText(myInvite.inviteCode);
    toast({ title: "Code copié", emoji: "📋", accent: "emerald" });
  };
  const copyLink = () => {
    if (!myInvite) return;
    navigator.clipboard?.writeText(`${window.location.origin}/?add=${myInvite.inviteCode}`);
    toast({ title: "Lien d'invitation copié", description: "Partage-le pour t'ajouter en ami.", emoji: "🔗", accent: "emerald" });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Carte identité + code (hero) ──────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02] border border-foreground/[0.08] p-4">
        <div className="flex items-center gap-3 mb-3.5">
          <Avatar url={me.avatarUrl} name={me.displayName} size={42} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{me.displayName}</p>
            <p className="text-[11px] text-foreground/40">Niveau {myAgg.level} · {myAgg.badges} badge{myAgg.badges > 1 ? "s" : ""}</p>
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/35 mb-1.5">Ton code d&apos;ami</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-background/80 border border-foreground/10 font-mono text-base font-bold tracking-[0.2em] text-center text-foreground">
            {myInvite ? myInvite.inviteCode : <span className="text-foreground/20 tracking-normal font-sans text-xs">génération…</span>}
          </div>
          <IconBtn onClick={copyCode} title="Copier le code" disabled={!myInvite}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </IconBtn>
          <IconBtn onClick={copyLink} title="Copier le lien d'invitation" disabled={!myInvite}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07L11.5 4.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L12.5 19.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </IconBtn>
        </div>
      </div>

      {/* ── Ajouter un ami ────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Ajouter un ami</SectionLabel>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Coller un code…"
            className="flex-1 min-w-0 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 transition-colors uppercase tracking-wide"
          />
          <button onClick={handleAdd} disabled={!code.trim() || sending} className="px-3.5 py-2 rounded-xl bg-foreground text-background text-xs font-semibold disabled:opacity-30 transition-all flex-shrink-0">
            Ajouter
          </button>
        </div>
      </div>

      {/* ── Demandes reçues ───────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <SectionLabel>Demandes · {pending.length}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {pending.map((p) => (
              <div key={p.friendshipId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-foreground/[0.03] border border-foreground/[0.07]">
                <Avatar url={p.avatarUrl} name={p.displayName} size={30} />
                <p className="flex-1 min-w-0 text-[13px] font-medium text-foreground truncate">{p.displayName}</p>
                <button onClick={async () => { if (await acceptRequest(p.friendshipId)) { toast({ title: "Ami ajouté 🎉", accent: "emerald" }); refresh(); } }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/25 transition-all" title="Accepter">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button onClick={async () => { if (await removeFriendship(p.friendshipId)) refresh(); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-foreground/5 text-foreground/40 hover:text-foreground/70 transition-all" title="Refuser">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Classement ────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel
          right={
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-foreground/5">
              {SORT_TABS.map((t) => (
                <button key={t.id} onClick={() => setSort(t.id)} className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium transition-all", sort === t.id ? "bg-background text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground/70")}>
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          Classement {focusingFriends.length > 0 && <span className="text-emerald-500 dark:text-emerald-400 normal-case tracking-normal">· {focusingFriends.length} en focus</span>}
        </SectionLabel>

        {leaderboard.length <= 1 ? (
          <p className="text-[13px] text-foreground/35 px-0.5 py-3 leading-relaxed">Ajoute des amis avec leur code pour comparer vos semaines de focus 🏆</p>
        ) : (
          <div className="flex flex-col gap-1">
            {leaderboard.map((r, i) => (
              <div key={r.id} className={cn("flex items-center gap-2.5 pl-2 pr-2.5 py-2 rounded-xl transition-colors", r.isMe ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.03]")}>
                <span className={cn("w-4 text-center text-[13px] font-bold tabular-nums flex-shrink-0", i === 0 ? "text-amber-400" : i === 1 ? "text-foreground/50" : i === 2 ? "text-orange-400/70" : "text-foreground/25")}>{i + 1}</span>
                <Avatar url={r.avatar} name={r.name} size={32} focusing={r.focusing} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{r.name}{r.isMe && <span className="text-foreground/35 font-normal"> · toi</span>}</p>
                  <p className="text-[10px] text-foreground/35">Niv. {r.level}{r.focusing && <span className="text-emerald-500 dark:text-emerald-400"> · en focus</span>}</p>
                </div>
                <span className="text-[13px] font-semibold text-foreground tabular-nums flex-shrink-0">
                  {sort === "minutes" ? fmtMin(r.minutes) : sort === "sessions" ? r.sessions : `${r.streak}j`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mes amis ──────────────────────────────────────────────────────── */}
      {friends.length > 0 && (
        <div>
          <SectionLabel>Mes amis · {friends.length}</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {friends.map((f) => (
              <div key={f.userId} className="group flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-foreground/[0.03] transition-colors">
                <Avatar url={f.avatarUrl} name={f.displayName} size={28} focusing={isActivelyFocusing(f.stats, now)} />
                <p className="flex-1 min-w-0 text-[13px] text-foreground/85 truncate">{f.displayName}</p>
                <button onClick={async () => { if (await removeFriendship(f.friendshipId)) { toast({ title: "Ami retiré", accent: "amber" }); refresh(); } }} className="sm:opacity-0 sm:group-hover:opacity-100 text-foreground/30 hover:text-red-400 transition-all p-1.5 -m-1 flex-shrink-0" title="Retirer">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className="w-9 h-9 flex items-center justify-center rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/55 hover:text-foreground disabled:opacity-30 transition-all flex-shrink-0">
      {children}
    </button>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-foreground/40 px-2">
      <UsersIcon className="w-9 h-9" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs max-w-[15rem]">{text}</p>
    </div>
  );
}
