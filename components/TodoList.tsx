"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import TodoStatusDropdown from "@/components/TodoStatusDropdown";

export default function TodoList() {
  const { todos, addTodo, setTodoStatus, deleteTodo, clearDone } = useSessionStore();
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

  const pending = todos.filter((t) => t.status !== "done");
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

      {/* Items */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 pr-3">
          {todos.length === 0 && (
            <p className="text-white/20 text-xs text-center py-6">
              Aucune tâche — profite du flow ✌
            </p>
          )}

          {pending.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 group transition-colors"
            >
              <TodoStatusDropdown
                status={todo.status}
                onChange={(s) => setTodoStatus(todo.id, s)}
                dark
              />
              <span className="flex-1 text-xs text-white/70 min-w-0 truncate">{todo.text}</span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-white/60 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}

          {done.length > 0 && (
            <>
              <div className="h-px bg-white/5 my-1.5 mx-3" />
              {done.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 group transition-colors opacity-50"
                >
                  <TodoStatusDropdown
                    status={todo.status}
                    onChange={(s) => setTodoStatus(todo.id, s)}
                    dark
                  />
                  <span className="flex-1 text-xs text-white/30 line-through min-w-0 truncate">{todo.text}</span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-white/50 transition-all flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
