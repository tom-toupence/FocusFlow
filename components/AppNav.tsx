"use client";

import { useNavStore, NavSection } from "@/store/navStore";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };

const ICONS: Record<NavSection, (p: IconProps) => React.ReactElement> = {
  accueil: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ecouter: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
  organisation: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" strokeLinecap="round" />
    </svg>
  ),
  activite: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl transition-all",
        layout === "rail" ? "w-full py-2.5" : "flex-1 py-1.5",
        active ? "text-foreground" : "text-foreground/40 hover:text-foreground/70"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn(
        "flex items-center justify-center rounded-xl transition-all",
        layout === "rail" ? "w-10 h-9" : "w-9 h-7",
        active ? "bg-foreground/15" : "hover:bg-foreground/5"
      )}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="text-[10px] font-medium tracking-tight">{LABELS[s]}</span>
    </button>
  );
}

/** Sidebar verticale (desktop) + barre d'onglets basse (mobile). */
export default function AppNav() {
  const { section, setSection } = useNavStore();

  return (
    <>
      {/* Desktop rail */}
      <nav className="hidden md:flex flex-col items-center gap-1 w-20 shrink-0 sticky top-0 h-screen border-r border-foreground/[0.06] bg-background/60 backdrop-blur-sm py-4 px-2">
        <div className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-sm mb-3" title="FocusFlow">
          F
        </div>
        {ORDER.map((s) => (
          <NavButton key={s} s={s} active={section === s} onClick={() => setSection(s)} layout="rail" />
        ))}
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch gap-1 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t border-foreground/[0.08] bg-background/90 backdrop-blur-md">
        {ORDER.map((s) => (
          <NavButton key={s} s={s} active={section === s} onClick={() => setSection(s)} layout="bar" />
        ))}
      </nav>
    </>
  );
}
