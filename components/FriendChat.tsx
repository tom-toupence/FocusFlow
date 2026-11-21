"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { useFriendsStore } from "@/store/friendsStore";
import { isActivelyFocusing, isOnline } from "@/lib/friends";
import { cn } from "@/lib/utils";

// Fenêtre de conversation (glisse par-dessus le panneau Amis, façon launcher).
// Montée en permanence dans le tiroir ; visible seulement quand une conversation
// est ouverte (openFriendId). Les messages arrivent en temps réel (chatStore).
export default function FriendChat() {
  const openFriendId = useChatStore((s) => s.openFriendId);
  const messagesMap = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loadingConvo);
  const closeChat = useChatStore((s) => s.closeChat);
  const send = useChatStore((s) => s.send);
  const friends = useFriendsStore((s) => s.friends);

  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const friend = friends.find((f) => f.userId === openFriendId) ?? null;
  const messages = openFriendId ? messagesMap[openFriendId] ?? [] : [];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll en bas à l'ouverture et à chaque nouveau message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, openFriendId, loading]);

  // Focus l'input à l'ouverture.
  useEffect(() => { if (openFriendId) inputRef.current?.focus(); }, [openFriendId]);

  const submit = () => {
    const body = draft.trim();
    if (!body || !openFriendId) return;
    setDraft("");
    send(openFriendId, body);
  };

  const status = friend
    ? isActivelyFocusing(friend.stats, now)
      ? (friend.stats?.activity || "En focus")
      : isOnline(friend.stats, now) ? "En ligne" : "Hors ligne"
    : "";
  const statusColor = friend && isActivelyFocusing(friend.stats, now)
    ? "text-emerald-500 dark:text-emerald-400"
    : friend && isOnline(friend.stats, now) ? "text-emerald-500/80 dark:text-emerald-400/80" : "text-foreground/35";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col bg-background transition-transform duration-300 ease-out",
        openFriendId ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
      aria-hidden={!openFriendId}
    >
      {/* En-tête conversation */}
      <div className="flex items-center gap-2.5 px-3 h-14 border-b border-foreground/[0.08] flex-shrink-0">
        <button onClick={closeChat} aria-label="Retour" className="w-8 h-8 -ml-1 flex items-center justify-center rounded-lg text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-all flex-shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center ring-1 ring-foreground/[0.06] flex-shrink-0">
          {friend?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-xs font-semibold text-foreground/60">{(friend?.displayName ?? "?").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{friend?.displayName ?? "Ami"}</p>
          <p className={cn("text-[11px] truncate", statusColor)}>{status}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
        {loading ? (
          <p className="text-center text-xs text-foreground/30 py-8">Chargement…</p>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4">
            <div className="w-12 h-12 rounded-2xl bg-foreground/[0.05] flex items-center justify-center">
              <svg className="w-6 h-6 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-[13px] text-foreground/40">Envoie le premier message à {friend?.displayName ?? "ton ami"}.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            // Conversation 1-à-1 : un message est « à moi » dès que son émetteur
            // n'est pas l'ami. Robuste même si l'auth n'est pas encore résolue
            // (évite les bulles toutes de la même couleur au 1er rendu).
            const mine = m.senderId !== openFriendId;
            const prev = messages[i - 1];
            const grouped = prev && prev.senderId === m.senderId && m.createdAt - prev.createdAt < 5 * 60 * 1000;
            return (
              <div key={m.id} className={cn("flex flex-col max-w-[82%]", mine ? "self-end items-end" : "self-start items-start", grouped ? "mt-0.5" : "mt-1.5")}>
                <div className={cn(
                  "px-3 py-2 rounded-2xl text-[13px] leading-snug break-words whitespace-pre-wrap",
                  mine ? "bg-foreground text-background rounded-br-md" : "bg-foreground/[0.07] text-foreground rounded-bl-md"
                )}>
                  {m.body}
                </div>
                <span className="text-[9px] text-foreground/25 px-1 mt-0.5">{fmtTime(m.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Saisie */}
      <div className="flex items-end gap-2 p-2.5 border-t border-foreground/[0.08] flex-shrink-0">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="Message…"
          className="flex-1 min-w-0 resize-none max-h-24 bg-foreground/5 border border-foreground/10 rounded-2xl px-3.5 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 transition-colors"
        />
        <button onClick={submit} disabled={!draft.trim()} aria-label="Envoyer"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30 transition-all flex-shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

function fmtTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? hm : `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${hm}`;
}
