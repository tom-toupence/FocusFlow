import { notFound } from "next/navigation";
import FriendStreetLab from "@/components/lab/FriendStreetLab";

// Banc d'essai de « Ta rue » avec des amis simulés. Développement seulement (ou NEXT_PUBLIC_LAB=1).
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  return <FriendStreetLab />;
}
