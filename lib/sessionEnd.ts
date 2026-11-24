import { useTimerStore } from "@/store/timerStore";
import { useStatsStore } from "@/store/statsStore";
import { toast } from "@/components/Toast";

/**
 * À appeler AVANT de démarrer une nouvelle session (réglages, sprint, routine,
 * onboarding) : si une session est encore active, on crédite le travail partiel,
 * on la clôt et on prévient. Sans effet sinon.
 *
 * Écart assumé avec « Terminer » : l'historique de lecture n'est pas alimenté,
 * car il a besoin du média courant, que seule la page de session connaît.
 */
export function closeActiveSession(): void {
  const timer = useTimerStore.getState();
  if (!timer.active) return;
  timer.tick();
  timer.pause();
  const t = useTimerStore.getState();
  if (t.mode === "work") {
    const minutes =
      t.settings.preset === "flowtime"
        ? t.accumulateFlow()
        : Math.round((t.cycleSeconds - t.secondsLeft) / 60);
    if (minutes >= 1) useStatsStore.getState().recordSession(minutes);
  }
  useTimerStore.getState().endSession();
  toast({ title: "Session précédente terminée" });
}
