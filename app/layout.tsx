import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// `viewport-fit=cover` active env(safe-area-inset-*) sur iPhone à encoche —
// AppNav/CreateMenu/AddToMenu s'en servent déjà pour leurs bottom-bars.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FocusFlow — Pomodoro + Lofi",
  description: "Reste focus avec un timer Pomodoro et de la musique lofi YouTube",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full dark`}>
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
