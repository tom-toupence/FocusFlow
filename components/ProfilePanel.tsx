"use client";

import { useEffect, useRef, useState } from "react";
import { useProfileStore, resolvedProfile } from "@/store/profileStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { loginWithSpotify } from "@/lib/spotify";
import { loginWithTwitch } from "@/lib/twitch";
import { signOut } from "@/lib/supabase";
import { upsertProfile } from "@/lib/db";
import { getCurrentUserId } from "@/lib/authState";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Resize an image file to 128×128 and return as base64 data URL
async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        // Crop to square from centre
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Avatar({ url, name, size = 10 }: { url: string | null; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover flex-shrink-0`;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cls} />;
  }
  return (
    <div className={`${cls} bg-foreground/10 flex items-center justify-center`}>
      <span className="text-foreground/60 font-semibold" style={{ fontSize: size * 3.5 }}>
        {name[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}

export default function ProfilePanel({ open, onClose }: Props) {
  const profile = useProfileStore();
  const spotify = useSpotifyStore();
  const twitch = useTwitchStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const { displayName, avatarUrl } = resolvedProfile(profile);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isSpotifyConnected = !!spotify.accessToken;
  const isTwitchConnected = !!twitch.accessToken;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // ── Name edit ──────────────────────────────────────────────────────────────

  const handleStartEdit = () => {
    setNameInput(displayName);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const name = nameInput.trim() || null;
    setSavingName(true);
    profile.setCustomDisplayName(name);
    const userId = getCurrentUserId();
    if (userId) {
      await upsertProfile(userId, { displayName: name, avatarData: profile.customAvatarData });
    }
    setSavingName(false);
    setEditingName(false);
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file);
      profile.setCustomAvatarData(dataUrl);
      const userId = getCurrentUserId();
      if (userId) {
        await upsertProfile(userId, { displayName: profile.customDisplayName, avatarData: dataUrl });
      }
    } catch {
      // ignore
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    profile.setCustomAvatarData(null);
    const userId = getCurrentUserId();
    if (userId) {
      await upsertProfile(userId, { displayName: profile.customDisplayName, avatarData: null });
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    // AuthGate will redirect to login screen after signOut
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed right-4 top-[60px] z-50 bg-background border border-foreground/[0.09] rounded-2xl shadow-2xl shadow-black/20 overflow-hidden flex flex-col"
        style={{ width: 300 }}
      >
        {/* ── Profile section ─────────────────────────────────────────────── */}
        <div className="p-4 border-b border-foreground/[0.06]">
          <div className="flex items-center gap-3">
            {/* Avatar with upload overlay */}
            <div className="relative flex-shrink-0 group">
              <Avatar url={avatarUrl} name={displayName} size={12} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
                    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="flex-1 text-sm font-medium bg-foreground/8 border border-foreground/20 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-foreground/40 min-w-0"
                    placeholder="Ton prénom"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="text-foreground/50 hover:text-foreground/90 transition-colors flex-shrink-0"
                  >
                    {savingName ? (
                      <div className="w-3.5 h-3.5 border border-foreground/30 border-t-foreground/70 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors text-left truncate w-full flex items-center gap-1 group/name"
                >
                  <span className="truncate">{displayName}</span>
                  <svg className="w-3 h-3 text-foreground/25 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <p className="text-[11px] text-foreground/35 truncate mt-0.5">{profile.googleEmail ?? ""}</p>
            </div>
          </div>

          {/* Avatar actions */}
          {profile.customAvatarData && (
            <button
              onClick={handleRemoveAvatar}
              className="mt-2 text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              Retirer la photo personnalisée
            </button>
          )}
        </div>

        {/* ── Connected services ───────────────────────────────────────────── */}
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider px-1">Services connectés</p>

          {/* Spotify */}
          <div className="rounded-xl p-3 bg-foreground/[0.03] border border-foreground/[0.06]">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#1db954] flex-shrink-0" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span className="text-xs font-medium text-foreground/50 flex-1">Spotify</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", isSpotifyConnected ? "bg-[#1db954]" : "bg-foreground/15")} />
            </div>

            {isSpotifyConnected ? (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar url={spotify.avatarUrl} name={spotify.displayName ?? "S"} size={8} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium text-foreground truncate">{spotify.displayName ?? "Spotify"}</p>
                      {spotify.isPremium === true && (
                        <span className="text-[9px] px-1 py-0.5 rounded-md bg-[#1db954]/15 text-[#1db954] font-bold">PREMIUM</span>
                      )}
                      {spotify.isPremium === false && (
                        <span className="text-[9px] px-1 py-0.5 rounded-md bg-orange-500/15 text-orange-400 font-bold">FREE</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-foreground/[0.05]">
                  <button onClick={() => { spotify.clearAuth(); loginWithSpotify(); }} className="text-[11px] text-foreground/40 hover:text-foreground/80 transition-colors">
                    Changer
                  </button>
                  <span className="text-foreground/15 text-xs">·</span>
                  <button onClick={() => { spotify.clearAuth(); onClose(); }} className="text-[11px] text-foreground/35 hover:text-red-400 transition-colors">
                    Déconnecter
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { loginWithSpotify(); onClose(); }}
                className="w-full mt-2 py-1.5 rounded-lg bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-semibold transition-all"
              >
                Connecter Spotify
              </button>
            )}
          </div>

          {/* Twitch */}
          <div className="rounded-xl p-3 bg-foreground/[0.03] border border-foreground/[0.06]">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#9146ff] flex-shrink-0" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
              </svg>
              <span className="text-xs font-medium text-foreground/50 flex-1">Twitch</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", isTwitchConnected ? "bg-[#9146ff]" : "bg-foreground/15")} />
            </div>

            {isTwitchConnected ? (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar url={twitch.avatarUrl} name={twitch.userDisplayName ?? twitch.userLogin ?? "T"} size={8} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{twitch.userDisplayName ?? twitch.userLogin ?? "Twitch"}</p>
                    {twitch.userLogin && twitch.userDisplayName && twitch.userDisplayName !== twitch.userLogin && (
                      <p className="text-[10px] text-foreground/30">@{twitch.userLogin}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-foreground/[0.05]">
                  <button onClick={() => { twitch.clearAuth(); loginWithTwitch(true); }} className="text-[11px] text-foreground/40 hover:text-foreground/80 transition-colors">
                    Changer
                  </button>
                  <span className="text-foreground/15 text-xs">·</span>
                  <button onClick={() => { twitch.clearAuth(); onClose(); }} className="text-[11px] text-foreground/35 hover:text-red-400 transition-colors">
                    Déconnecter
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { loginWithTwitch(); onClose(); }}
                className="w-full mt-2 py-1.5 rounded-lg bg-[#9146ff] hover:bg-[#7c3ae0] text-white text-xs font-semibold transition-all"
              >
                Connecter Twitch
              </button>
            )}
          </div>
        </div>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <div className="p-3 pt-0">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-foreground/[0.08] text-xs text-foreground/40 hover:text-red-400 hover:border-red-400/30 transition-all disabled:opacity-50"
          >
            {signingOut ? (
              <div className="w-3.5 h-3.5 border border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
              </svg>
            )}
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </div>
    </>
  );
}
