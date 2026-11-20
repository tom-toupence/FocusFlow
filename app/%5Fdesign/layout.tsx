import type { Metadata } from "next";

// Page interne du système de design (/_design). Non indexée.
export const metadata: Metadata = {
  title: "Système · FocusFlow",
  robots: { index: false, follow: false },
};

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
