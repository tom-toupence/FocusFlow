import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCKS } from "./_registry";

const RANK: Record<string, number> = { S: 1, M: 2, L: 3 };

// Index des propositions de features (mode PROPOSITION). Le dossier complet,
// avec schémas, est dans docs/features/proposals/index.html.
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  const sortFn = (a: (typeof MOCKS)[number], b: (typeof MOCKS)[number]) => b.value / RANK[b.effort] - a.value / RANK[a.effort];
  const wave3 = MOCKS.filter((m) => m.wave === 3);
  const wave2 = MOCKS.filter((m) => m.wave === 2);
  const kept = MOCKS.filter((m) => m.status === "oui");
  const list = [...wave3, ...wave2, ...kept.sort(sortFn)];
  return (
    <main className="min-h-screen bg-[#07090d] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Lab · propositions</div>
        <h1 className="mt-2 text-3xl font-semibold">Features proposées</h1>
        <p className="mt-2 text-sm text-white/60">Vague 3 en tête (par audace et valeur), puis la vague 2 et les idées retenues de la vague 1. Rien n&apos;est branché.</p>
        <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {list.map((m, i) => (
            <li key={m.slug}>
              <Link href={`/lab/features/${m.slug}`} className="flex items-center gap-4 py-4 hover:bg-white/5">
                <span className="w-6 font-mono text-xs text-white/40">{i + 1}</span>
                <span className="flex-1"><span className="block">{m.name}</span><span className="block text-sm text-white/50">{m.pitch}</span></span>
                <span className="font-mono text-xs text-white/60">{m.wave === 3 ? "vague 3 · " : m.wave === 2 ? "vague 2 · " : ""}{m.status === "oui" ? "retenue · " : ""}{m.effort} · {m.value}/5</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
