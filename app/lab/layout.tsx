import type { Metadata } from "next";
import { notFound } from "next/navigation";

// /lab : prototypes jetables de la refonte (docs/redesign/LAB.md).
// Exclu de la production : 404 sauf si NEXT_PUBLIC_LAB=1 est posé explicitement.
export const metadata: Metadata = {
  title: "Lab · FocusFlow",
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  return children;
}
