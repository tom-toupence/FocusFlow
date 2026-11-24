// Maquettes de propositions de features (mode PROPOSITION, rien n'est branché).
// Volontairement statiques : elles servent à comprendre l'idée, pas à juger le style.
import type { ReactNode } from "react";

/** Fond de session (photo de rue voilée), pour situer l'élément dans l'app. */
export function SessionFrame({ children, still = "/rue/ruelle/still.webp" }: { children: ReactNode; still?: string }) {
  return (
    <div className="relative h-[720px] w-[1280px] overflow-hidden bg-[#07090d] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

/** Fond du site connecté (sombre). */
export function AppFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="relative min-h-[720px] w-[1280px] overflow-hidden bg-[#0b0e13] text-white">
      <div className="flex min-h-[720px]">
        <aside className="w-56 shrink-0 border-r border-white/10 px-5 py-6">
          <div className="mb-8 text-sm font-semibold tracking-tight">FocusFlow</div>
          {["Aujourd'hui", "Écouter", "Organisation", "Activité"].map((s) => (
            <div key={s} className={"mb-1 rounded-lg px-3 py-2 text-sm " + (s === title ? "bg-white/10 text-white" : "text-white/50")}>{s}</div>
          ))}
        </aside>
        <main className="flex-1 px-10 py-10">{children}</main>
      </div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{children}</div>;
}

export function Pill({ children, primary, active }: { children: ReactNode; primary?: boolean; active?: boolean }) {
  return (
    <span
      className={
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-xs " +
        (primary ? "border-white bg-white font-medium text-black"
          : active ? "border-white/30 bg-white/20 text-white"
          : "border-white/15 bg-black/50 text-white/75")
      }
    >
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 " + className}>{children}</div>;
}

/** Bandeau « maquette » + note explicative sous l'écran. */
export function Annot({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-sm text-white/70">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[oklch(0.72_0.13_210)] font-mono text-xs font-semibold text-black">{n}</span>
      <span>{children}</span>
    </div>
  );
}

export function Marker({ n, className }: { n: number; className: string }) {
  return (
    <span className={"absolute z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.72_0.13_210)] font-mono text-xs font-semibold text-black ring-4 ring-black/40 " + className}>{n}</span>
  );
}

export const CYAN = "oklch(0.72 0.13 210)";
export const SODIUM = "oklch(0.78 0.15 70)";
