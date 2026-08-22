"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Tab<T extends string> {
  id: T;
  label: string;
}

/** Contrôle segmenté de sous-navigation (même langage que le sélecteur de
 *  sources « Écouter ») : l'indicateur GLISSE vers l'onglet choisi. */
export default function SubTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Tab<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  // Un layoutId par instance : deux SubTabs montés en même temps ne doivent pas
  // se voler leur indicateur.
  const group = useId();

  return (
    <div className="mb-7 inline-flex flex-wrap gap-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "relative rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            active === t.id ? "text-foreground" : "text-foreground/40 hover:text-foreground/75"
          )}
        >
          {active === t.id && (
            <motion.span
              layoutId={`subtab-${group}`}
              className="absolute inset-0 rounded-lg bg-foreground/[0.1]"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
