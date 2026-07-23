"use client";

import { useRef, useEffect, useState } from "react";
import type { StickyNote as StickyNoteType } from "@/store/notesStore";
import { useNotesStore } from "@/store/notesStore";

const NOTE_COLORS = [
  { value: "#fef08a", label: "Jaune" },
  { value: "#86efac", label: "Vert" },
  { value: "#93c5fd", label: "Bleu" },
  { value: "#f9a8d4", label: "Rose" },
  { value: "#d8b4fe", label: "Violet" },
];

const NOTE_WIDTH = 176; // w-44

export default function StickyNote({ note }: { note: StickyNoteType }) {
  const { updateNote, removeNote } = useNotesStore();
  const [text, setText] = useState(note.text);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Keep local text in sync if store reloads (e.g. hydration)
  useEffect(() => { setText(note.text); }, [note.text]);

  // Rapatrie un post-it hors écran (créé sur un écran plus large) au montage.
  useEffect(() => {
    const maxX = window.innerWidth - NOTE_WIDTH;
    const maxY = window.innerHeight - 60;
    if (note.x > maxX || note.y > maxY) {
      updateNote(note.id, { x: Math.max(8, Math.min(note.x, maxX)), y: Math.max(8, Math.min(note.y, maxY)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag via Pointer Events → fonctionne à la souris ET au tactile.
  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - note.x, y: e.clientY - note.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const maxX = window.innerWidth - NOTE_WIDTH;
    const maxY = window.innerHeight - 40;
    updateNote(note.id, {
      x: Math.max(0, Math.min(e.clientX - offset.current.x, maxX)),
      y: Math.max(0, Math.min(e.clientY - offset.current.y, maxY)),
    });
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  };

  return (
    <div
      style={{ left: note.x, top: note.y, position: "fixed", zIndex: 50 }}
      className="w-44 shadow-xl shadow-black/40 rounded-lg overflow-hidden select-none"
    >
      {/* Header — drag handle (touch-action:none → pas de scroll pendant le drag) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ background: note.color, touchAction: "none" }}
        className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing"
      >
        {/* Color picker */}
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => updateNote(note.id, { color: c.value })}
              style={{ background: c.value }}
              className="w-4 h-4 sm:w-3 sm:h-3 rounded-full border border-black/10 hover:scale-125 transition-transform"
            />
          ))}
        </div>
        {/* Delete */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => removeNote(note.id)}
          className="text-black/30 hover:text-black/60 transition-colors leading-none p-1 -m-1"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => updateNote(note.id, { text })}
        placeholder="Note..."
        style={{ background: note.color }}
        className="w-full h-28 resize-none text-xs text-black/80 placeholder:text-black/35 px-2.5 py-2 focus:outline-none"
      />
    </div>
  );
}
