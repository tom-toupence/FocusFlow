import type { Metadata } from "next";
import HandoffClient from "@/components/remote/HandoffClient";

// « Emporter la session » (lot 7) : hors AuthGate, utilisable sans compte.
// Le code et le secret sont dans le fragment (#c=…&k=…) : jamais envoyés au serveur.
export const metadata: Metadata = { title: "Continuer sur le téléphone · FocusFlow", robots: { index: false }, referrer: "no-referrer" };

export default function Page() {
  return <HandoffClient />;
}
