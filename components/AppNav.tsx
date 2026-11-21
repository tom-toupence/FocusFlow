"use client";

import { motion, useReducedMotion } from "motion/react";
import { useNavStore, NavSection } from "@/store/navStore";
import { cn } from "@/lib/utils";
import { T, tr } from "@/lib/motion";

type IconProps = { className?: string };

const ICONS: Record<NavSection, (p: IconProps) => React.ReactElement> = {
  accueil: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ecouter: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
  organisation: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" strokeLinecap="round" />
    </svg>
  ),
  activite: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const LABELS: Record<NavSection, string> = {
  accueil: "Accueil",
  ecouter: "Écouter",
  organisation: "Organisation",
  activite: "Activité",
};

const ORDER: NavSection[] = ["accueil", "ecouter", "organisation", "activite"];

function NavButton({
  s, active, onClick, layout,
}: { s: NavSection; active: boolean; onClick: () => void; layout: "rail" | "bar" }) {
  const Icon = ICONS[s];
  const reduce = useReducedMotion();
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1.5 transition-colors duration-[var(--d-ui)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium rounded-[var(--r-control)]",
        layout === "rail" ? "w-full py-3" : "flex-1 py-2",
        active ? "text-ink" : "text-ink-3 hover:text-ink-2"
      )}
      aria-current={active ? "page" : undefined}
    >
      {/* Trait de niveau sodium : il GLISSE d'une section à l'autre (layoutId),
          à gauche sur le rail, en haut sur la barre mobile. */}
      {active && (
        <motion.span
          layoutId={`nav-level-${layout}`}
          aria-hidden
          className={cn(
            "absolute bg-sodium",
            layout === "rail" ? "left-0 top-2 bottom-2 w-[2px]" : "top-0 left-1/4 right-1/4 h-[2px]"
          )}
          transition={tr(T.spring, reduce)}
        />
      )}
      <Icon className="relative w-[19px] h-[19px]" />
      <span className={cn("text-[11px] tracking-tight", active && "font-semibold")}>{LABELS[s]}</span>
    </button>
  );
}

/** Sidebar verticale (desktop) + barre d'onglets basse (mobile). */
export default function AppNav() {
  const { section, setSection } = useNavStore();

  return (
    <>
      {/* Rail desktop : la marque est une petite tour dont les étages s'allument
          (la même façade que la jauge : vert = fait, sodium = maintenant). */}
      <nav aria-label="Navigation principale" className="hidden md:flex flex-col items-center gap-1 w-[84px] shrink-0 sticky top-0 h-screen border-r border-line bg-bg py-5">
        <div className="mb-6 flex items-end h-9" title="FocusFlow" aria-label="FocusFlow">
          <svg width="14" height="34" viewBox="0 0 14 34" aria-hidden>
            {Array.from({ length: 6 }, (_, f) => (
              [0, 1].map((c) => (
                <rect
                  key={`${f}-${c}`}
                  x={c * 7}
                  y={34 - (f + 1) * 5.6}
                  width={6}
                  height={4.6}
                  rx={0.6}
                  fill={f < 3 ? "var(--konbini)" : f === 3 && c === 0 ? "var(--sodium)" : "var(--surface-2)"}
                  stroke={f > 3 || (f === 3 && c === 1) ? "var(--line)" : "none"}
                  strokeWidth={0.5}
                />
              ))
            ))}
          </svg>
        </div>
        {ORDER.map((s) => (
          <NavButton key={s} s={s} active={section === s} onClick={() => setSection(s)} layout="rail" />
        ))}
      </nav>

      {/* Barre basse mobile */}
      <nav aria-label="Navigation principale" className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t border-line bg-bg">
        {ORDER.map((s) => (
          <NavButton key={s} s={s} active={section === s} onClick={() => setSection(s)} layout="bar" />
        ))}
      </nav>
    </>
  );
}
