"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  theme: "dark" | "light";
  toggle: () => void;
  apply: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",

      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },

      apply: () => {
        applyTheme(get().theme);
      },
    }),
    { name: "focusflow-theme" }
  )
);

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}
