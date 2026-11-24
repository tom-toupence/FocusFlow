"use client";

// Le décor de la pause : « Ta rue » (components/FriendStreet.tsx) si tu as des
// amis, sinon la rue de nuit aléatoire comme avant. Sans Supabase ou sans
// amis, rien ne change. Jamais sous une vidéo (la pause n'en joue pas).
import { forwardRef, useImperativeHandle, useRef, type ComponentProps } from "react";
import RueScene, { type RueHandle } from "@/components/RueScene";
import FriendStreet from "@/components/FriendStreet";
import { useFriendsStore } from "@/store/friendsStore";

type Props = ComponentProps<typeof RueScene>;

const PauseStreet = forwardRef<RueHandle, Props>(function PauseStreet(props, ref) {
  const hasFriends = useFriendsStore((s) => s.friends.length > 0);
  const inner = useRef<RueHandle>(null);
  useImperativeHandle(ref, () => ({
    pomodoroDone: () => inner.current?.pomodoroDone(),
    goal: () => inner.current?.goal(),
    next: () => inner.current?.next(),
    setScroll: (v) => inner.current?.setScroll(v),
  }), []);
  if (hasFriends) return <FriendStreet className={props.className} label={`${props.label} Tes amis sont les fenêtres de la façade.`} />;
  // Ta rue remplace la scène : pas de fenêtres d'amis en double dans la rue.
  return <RueScene ref={inner} {...props} />;
});

export default PauseStreet;
