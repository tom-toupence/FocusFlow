import { notFound } from "next/navigation";
import SeoulLab from "@/components/lab/SeoulLab";

// Laboratoire : visible en développement seulement (ou avec NEXT_PUBLIC_LAB=1).
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  return <SeoulLab />;
}
