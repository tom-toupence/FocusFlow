"use client";
import { useCallback, useRef } from "react";
import { parseLink } from "./crypto";

/**
 * Lien du QR lu une seule fois : le code et le secret restent en mémoire, et le
 * fragment est retiré de la barre d'adresse (historique, partage d'écran).
 * Un rechargement demande donc de rescanner le QR code.
 */
export function useLinkOnce() {
  const ref = useRef<{ read: boolean; link: { code: string; secret: string } | null }>({ read: false, link: null });
  // Fonction stable : elle sert de dépendance aux effets de connexion.
  return useCallback(() => {
    if (!ref.current.read) {
      ref.current = { read: true, link: parseLink(window.location.hash) };
      if (window.location.hash) {
        try { history.replaceState(history.state, "", window.location.pathname + window.location.search); } catch { /* ignoré */ }
      }
    }
    return ref.current.link;
  }, []);
}
