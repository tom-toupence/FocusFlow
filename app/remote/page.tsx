import type { Metadata } from "next";
import RemoteClient from "@/components/remote/RemoteClient";

// Télécommande du téléphone (lot 7) : hors AuthGate, utilisable sans compte.
// Le code et le secret sont dans le fragment (#c=…&k=…) : jamais envoyés au serveur.
export const metadata: Metadata = { title: "Télécommande · FocusFlow", robots: { index: false }, referrer: "no-referrer" };

export default function Page() {
  return <RemoteClient />;
}
