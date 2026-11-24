"use client";
import { useEffect } from "react";

/**
 * Garde l'écran allumé tant que `on` (Screen Wake Lock, iOS 16.4+ et Chrome).
 * Sans l'API, rien : la télécommande s'arrête quand le téléphone se verrouille.
 */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const request = async () => {
      // L'ancien verrou est libéré avant d'en redemander un (jamais deux à la fois).
      const old = lock;
      lock = null;
      if (old && !old.released) await old.release().catch(() => {});
      try {
        const l = await navigator.wakeLock.request("screen");
        if (alive) lock = l; else void l.release();
      } catch { /* refusé (économie d'énergie) : sans effet */ }
    };
    // Le verrou tombe quand la page est cachée : on le redemande au retour.
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}
