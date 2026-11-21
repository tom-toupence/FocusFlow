"use client";

// La ruelle dans la session : décor de la halte (pause) et fond du mode
// Spotify (aucune vidéo ne joue). Jamais par-dessus une vidéo YouTube/Twitch.
//
// La halte se JOUE à l'entrée : la scène monte allumée, puis les enseignes
// s'éteignent du fond vers nous (au lieu d'apparaître déjà éteintes).
import { forwardRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CityHandle } from "@/components/CityScene";
import type { CityPhase } from "@/lib/city/types";
import { useFriendsStore } from "@/store/friendsStore";
import { isActivelyFocusing } from "@/lib/friends";

const CityScene = dynamic(() => import("@/components/CityScene"), { ssr: false });

/** Nombre d'amis en focus en ce moment. */
export function useFriendsInFocus(): number {
  const friends = useFriendsStore((s) => s.friends);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now ? friends.filter((f) => isActivelyFocusing(f.stats, now)).length : 0;
}

interface Props {
  phase: CityPhase;
  board: string;
  className?: string;
  label: string;
}

const SessionCity = forwardRef<CityHandle, Props>(function SessionCity({ phase, board, className, label }, ref) {
  const friends = useFriendsInFocus();
  // Entrée en halte : on monte en « travail » puis on bascule, pour jouer l'extinction.
  const [shown, setShown] = useState<CityPhase>(phase === "break" ? "work" : phase);
  useEffect(() => {
    const id = setTimeout(() => setShown(phase), phase === "break" ? 700 : 0);
    return () => clearTimeout(id);
  }, [phase]);
  return <CityScene ref={ref} phase={shown} board={board} friends={friends} className={className} label={label} />;
});

export default SessionCity;
