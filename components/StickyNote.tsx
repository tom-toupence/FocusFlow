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

export default function StickyNote({ note }: { note: StickyNoteType }) {
  const { updateNote, removeNote } = useNotesStore();
  const [text, setText] = useState(note.text);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Keep local text in sync if store reloads (e.g. hydration)
  useEffect(() => { setText(note.text); }, [note.text]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - note.x, y: e.clientY - note.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      updateNote(note.id, {
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y,
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [note.id, updateNote]);

  return (
    <div
      style={{ left: note.x, top: note.y, position: "fixed", zIndex: 50 }}
      className="w-44 shadow-xl shadow-black/40 rounded-lg overflow-hidden select-none"
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{ background: note.color }}
        className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing"
      >
        {/* Color picker */}
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => updateNote(note.id, { color: c.value })}
              style={{ background: c.value }}
              className="w-3 h-3 rounded-full border border-black/10 hover:scale-125 transition-transform"
            />
          ))}
        </div>
        {/* Delete */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeNote(note.id)}
          className="text-black/30 hover:text-black/60 transition-colors leading-none"
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
