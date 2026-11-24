"use client";

// « Rejoindre et lancer un focus » depuis l'onglet Radio : session normale
// (preset courant), source = Radio FocusFlow, /session ouvert directement, sur
// le modèle du « Go » du sprint (lib/sprint.ts::launchSprintSession).
import { closeActiveSession } from "@/lib/sessionEnd";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useNotesStore } from "@/store/notesStore";

export function joinRadio(router: { push: (href: string) => void }): void {
  closeActiveSession();
  useTimerStore.getState().resetAll(); // garde les réglages (preset courant)
  // La radio est une source YouTube : Spotify et Twitch passeraient devant.
  useSpotifyStore.getState().selectPlaylist(null);
  useTwitchStore.getState().clear();
  const session = useSessionStore.getState();
  session.selectRadio();
  session.clearDone();
  useNotesStore.getState().clearAll();
  router.push("/session");
}
