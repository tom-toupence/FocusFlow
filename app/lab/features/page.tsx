import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCKS } from "./_registry";

const RANK: Record<string, number> = { S: 1, M: 2, L: 3 };

// Index des propositions de features (mode PROPOSITION). Le dossier complet,
// avec schémas, est dans docs/features/proposals/index.html.
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  const list = [...MOCKS].sort((a, b) => b.value / RANK[b.effort] - a.value / RANK[a.effort]);
  return (
    <main className="min-h-screen bg-[#07090d] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Lab · propositions</div>
        <h1 className="mt-2 text-3xl font-semibold">Features proposées</h1>
        <p className="mt-2 text-sm text-white/60">Triées par valeur / effort. Rien n&apos;est branché.</p>
        <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {list.map((m, i) => (
            <li key={m.slug}>
              <Link href={`/lab/features/${m.slug}`} className="flex items-center gap-4 py-4 hover:bg-white/5">
                <span className="w-6 font-mono text-xs text-white/40">{i + 1}</span>
                <span className="flex-1"><span className="block">{m.name}</span><span className="block text-sm text-white/50">{m.pitch}</span></span>
                <span className="font-mono text-xs text-white/60">{m.effort} · {m.value}/5</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
