import type { Metadata } from "next";
import HandoffClient from "@/components/remote/HandoffClient";

// « Emporter la session » (lot 7) : hors AuthGate, utilisable sans compte.
export const metadata: Metadata = { title: "Continuer sur le téléphone · FocusFlow", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HandoffClient rawCode={code} />;
}
