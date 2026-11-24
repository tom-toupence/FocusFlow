import type { Metadata } from "next";
import RemoteClient from "@/components/remote/RemoteClient";

// Télécommande du téléphone (lot 7) : hors AuthGate, utilisable sans compte.
export const metadata: Metadata = { title: "Télécommande · FocusFlow", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RemoteClient rawCode={code} />;
}
