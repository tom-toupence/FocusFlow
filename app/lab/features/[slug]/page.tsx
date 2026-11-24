import { notFound } from "next/navigation";
import { MOCKS } from "../_registry";

// Maquette d'une proposition de feature. Développement seulement (ou NEXT_PUBLIC_LAB=1).
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  const { slug } = await params;
  const entry = MOCKS.find((m) => m.slug === slug);
  if (!entry) notFound();
  return (
    <div className="min-h-screen bg-[#07090d]">
      {entry.screens.map((Screen, i) => (
        <div key={i} data-screen={i} className="w-[1280px]"><Screen /></div>
      ))}
    </div>
  );
}
