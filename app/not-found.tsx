import Link from "next/link";

// 404 : une tour dont un étage reste éteint. Pas de scène 3D ici (page rare,
// chargement léger) ; la façade suffit à dire où l'on est.
export default function NotFound() {
  const floors = 9;
  const dark = 4; // l'étage introuvable
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
      <div className="flex items-end gap-8 sm:gap-12 max-w-xl">
        <svg aria-hidden viewBox="0 0 56 160" className="w-12 sm:w-14 flex-shrink-0">
          {Array.from({ length: floors }, (_, f) => (
            <g key={f}>
              {[0, 1, 2].map((c) => (
                <rect
                  key={c}
                  x={4 + c * 17}
                  y={160 - (f + 1) * 17}
                  width={14}
                  height={12}
                  rx={1}
                  className={f === dark ? "fill-surface-2" : f < dark ? "fill-konbini" : "fill-line-strong"}
                />
              ))}
            </g>
          ))}
        </svg>
        <div>
          <p className="font-led text-sodium text-5xl sm:text-6xl leading-none">404</p>
          <h1 className="mt-4 text-3xl sm:text-4xl">Cet étage n&apos;existe pas</h1>
          <p className="mt-3 text-ink-2 text-[15px] leading-relaxed">
            L&apos;adresse ne mène nulle part. La ville, elle, est toujours allumée.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            Revenir à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
