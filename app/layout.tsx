import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Doto, Atkinson_Hyperlegible_Next } from "next/font/google";
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

// Trois familles, trois rôles (docs/redesign/03-SYSTEM.md, lab 2) :
// . Big Shoulders : titres et enseignes. Dessinée pour la signalétique de
//   Chicago : condensée, lisible de loin, taille optique variable.
// . Doto : l'afficheur à points d'un panneau de quai. Minuteur et grands
//   chiffres uniquement.
// . Atkinson Hyperlegible Next : tout le texte et les petits chiffres.
//   Conçue pour les basses visions, donc lisible la nuit, écran baissé.
const signage = Big_Shoulders({
  variable: "--font-signage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  axes: ["ROND"],
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
    <html lang="fr" className={`${signage.variable} ${doto.variable} ${atkinson.variable} h-full dark`} suppressHydrationWarning>
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
