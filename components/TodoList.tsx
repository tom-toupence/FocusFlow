"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useSessionStore, Todo, TodoStatus } from "@/store/sessionStore";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Mini-kanban vertical : 3 sections (À faire / En cours / Terminé), chaque
// carte se déplace dans les deux sens avec ← / →.

const SECTIONS: { status: TodoStatus; label: string; dot: string; text: string }[] = [
  { status: "todo",        label: "À faire",  dot: "bg-white/35",    text: "text-white/45" },
  { status: "in-progress", label: "En cours", dot: "bg-amber-400",   text: "text-amber-300/80" },
  { status: "done",        label: "Terminé",  dot: "bg-emerald-400", text: "text-emerald-300/80" },
];

const PREV: Partial<Record<TodoStatus, TodoStatus>> = { "in-progress": "todo", done: "in-progress" };
const NEXT: Partial<Record<TodoStatus, TodoStatus>> = { todo: "in-progress", "in-progress": "done" };

function MiniCard({ todo }: { todo: Todo }) {
  const { setTodoStatus, deleteTodo } = useSessionStore();
  const prev = PREV[todo.status];
  const next = NEXT[todo.status];

  return (
    <div className={cn(
      "group flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] hover:border-white/15 transition-colors",
      todo.status === "done" && "opacity-50"
    )}>
      <span className={cn(
        "flex-1 text-xs min-w-0 break-words leading-relaxed",
        todo.status === "done" ? "text-white/35 line-through" : "text-white/75"
      )}>
        {todo.text}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {prev && (
          <button
            onClick={() => setTodoStatus(todo.id, prev)}
            title="Reculer"
            className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/80 hover:bg-white/10 transition-all text-[11px]"
          >
            ←
          </button>
        )}
        {next && (
          <button
            onClick={() => setTodoStatus(todo.id, next)}
            title={next === "done" ? "Terminer" : "Commencer"}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded transition-all text-[11px]",
              next === "done"
                ? "text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/15"
                : "text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/15"
            )}
          >
            →
          </button>
        )}
        <button
          onClick={() => deleteTodo(todo.id)}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all"
          title="Supprimer"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function TodoList() {
  const { todos, addTodo, clearDone } = useSessionStore();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const text = input.trim();
    if (!text) return;
    addTodo(text);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  const done = todos.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">
          Tâches
        </p>
        {done.length > 0 && (
          <button
            onClick={clearDone}
            className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            Effacer terminées
          </button>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Nouvelle tâche..."
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20 rounded-xl text-sm h-9"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Mini kanban */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 pr-3">
          {todos.length === 0 && (
            <p className="text-white/20 text-xs text-center py-6">
              Aucune tâche — profite du flow ✌
            </p>
          )}

          {todos.length > 0 && SECTIONS.map((section) => {
            const items = todos.filter((t) => t.status === section.status);
            return (
              <div key={section.status}>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", section.dot)} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", section.text)}>
                    {section.label}
                  </span>
                  <span className="ml-auto text-[10px] text-white/20 tabular-nums">{items.length}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.length === 0 ? (
                    <p className="text-[10px] text-white/15 text-center py-1.5">–</p>
                  ) : (
                    items.map((todo) => <MiniCard key={todo.id} todo={todo} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
