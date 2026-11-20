import type { Metadata, Viewport } from "next";
import { Hahmlet, Azeret_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";
import AuthGate from "@/components/AuthGate";
import ToastHost from "@/components/Toast";
import CommandPalette from "@/components/CommandPalette";
import AmbientProvider from "@/components/AmbientProvider";
import SplashIntro from "@/components/SplashIntro";
import FriendsDrawer from "@/components/FriendsDrawer";
import FriendsLayoutShell from "@/components/FriendsLayoutShell";
import PresenceProvider from "@/components/PresenceProvider";

// Trois familles, trois rôles (docs/redesign/03-SYSTEM.md) :
// . Hahmlet : titres. Serif dessinée conjointement pour le hangeul et le latin
//   (fil coréen de la Clepsydre, sans pastiche).
// . Azeret Mono : tout ce qui est MESURÉ (minuteur, durées, graduations).
// . Atkinson Hyperlegible Next : corps. Conçue pour les basses visions, donc
//   lisible la nuit, écran baissé.
const hahmlet = Hahmlet({
  variable: "--font-hahmlet",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// `viewport-fit=cover` active env(safe-area-inset-*) sur iPhone à encoche —
// AppNav/CreateMenu/AddToMenu s'en servent déjà pour leurs bottom-bars.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FocusFlow",
  description: "Un minuteur Pomodoro et une ville la nuit dans le même écran. Gratuit, sans compte.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${hahmlet.variable} ${azeret.variable} ${atkinson.variable} h-full dark`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=JSON.parse(localStorage.getItem('focusflow-theme')||'{}').state?.theme;if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){}` }} />
      </head>
      <body className="min-h-full antialiased">
        <SupabaseProvider>
          <AuthGate>
            <FriendsLayoutShell>{children}</FriendsLayoutShell>
          </AuthGate>
        </SupabaseProvider>
        <ToastHost />
        <CommandPalette />
        <AmbientProvider />
        <PresenceProvider />
        <FriendsDrawer />
        <SplashIntro />
      </body>
    </html>
  );
}
