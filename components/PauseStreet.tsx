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
  // Ta rue dessine son propre voile de lecture, calé sur le texte de la pause
  // ([data-pause-text]) : il s'arrête avant la façade.
  if (hasFriends) return <FriendStreet className={props.className} label={`${props.label} Tes amis sont les fenêtres de la façade.`} />;
  // Voile de lecture sous le texte (à gauche sur grand écran, en bas sur téléphone).
  // Ta rue remplace la scène : pas de fenêtres d'amis en double dans la rue.
  return (
    <>
      <RueScene ref={inner} {...props} />
      <div aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#07090d_0%,rgba(7,9,13,0.86)_32%,rgba(7,9,13,0.15)_62%,transparent_80%)] max-md:bg-[linear-gradient(0deg,#07090d_0%,rgba(7,9,13,0.9)_45%,rgba(7,9,13,0.2)_70%,transparent_85%)]" />
    </>
  );
});

export default PauseStreet;
