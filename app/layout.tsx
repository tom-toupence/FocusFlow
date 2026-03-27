import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";
import AuthGate from "@/components/AuthGate";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

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
          <AuthGate>{children}</AuthGate>
        </SupabaseProvider>
      </body>
    </html>
  );
}
