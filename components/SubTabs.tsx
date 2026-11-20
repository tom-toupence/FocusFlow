"use client";

import { Segmented } from "@/components/ff/Segmented";

interface Tab<T extends string> {
  id: T;
  label: string;
}

/** Sous-navigation de section (Organisation, Activité) : le Segmented du
 *  système (libellés sur une ligne d'échelle, trait de niveau qui glisse). */
export default function SubTabs<T extends string>({
  tabs,
  active,
  onSelect,
  label = "Sous-sections",
}: {
  tabs: Tab<T>[];
  active: T;
  onSelect: (id: T) => void;
  label?: string;
}) {
  return <Segmented label={label} className="mb-10" items={tabs} value={active} onChange={onSelect} />;
}
