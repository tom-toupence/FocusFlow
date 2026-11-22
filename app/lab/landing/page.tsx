import { notFound } from "next/navigation";
import LandingPreview from "./preview";

// Aperçu de la landing sans compte ni Supabase (elle n'est montée que pour
// les visiteurs non connectés). Développement seulement.
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  return <LandingPreview />;
}
