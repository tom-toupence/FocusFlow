"use client";

import { cn } from "@/lib/utils";

interface Tab<T extends string> {
  id: T;
  label: string;
}

/** Pills de sous-navigation génériques (même style que le sélecteur de sources « Écouter »). */
export default function SubTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Tab<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-1.5 mb-6 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-medium transition-all",
            active === t.id ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
