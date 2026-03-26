"use client";

import dynamic from "next/dynamic";
import PomodoroTimer from "@/components/PomodoroTimer";
import VideoCatalog from "@/components/VideoCatalog";
import TodoList from "@/components/TodoList";

// VideoPlayer uses IFrame — avoid SSR hydration issues
const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-gray-900 rounded-2xl animate-pulse" />
  ),
});

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/50 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-semibold text-gray-100 tracking-tight">FocusFlow</span>
        <span className="text-gray-600 text-sm">Pomodoro + Lofi</span>
      </header>

      {/* Main layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
        {/* Left: Video + Timer */}
        <div className="flex flex-col gap-6 p-6">
          <VideoPlayer />
          <div className="flex justify-center">
            <PomodoroTimer />
          </div>
        </div>

        {/* Right: Catalog + Todos */}
        <div className="border-l border-gray-800/50 flex flex-col">
          <div className="p-5 border-b border-gray-800/50">
            <VideoCatalog />
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            <TodoList />
          </div>
        </div>
      </main>
    </div>
  );
}
