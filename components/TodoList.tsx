"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useSessionStore } from "@/store/sessionStore";

export default function TodoList() {
  const { todos, addTodo, toggleTodo, deleteTodo, clearDone } = useSessionStore();
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

  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Tâches
        </h2>
        {done.length > 0 && (
          <button
            onClick={clearDone}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Effacer terminées
          </button>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ajouter une tâche..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-3 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Todo items */}
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
        {todos.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">
            Aucune tâche — profite du flow !
          </p>
        )}

        {pending.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800/50 group"
          >
            <button
              onClick={() => toggleTodo(todo.id)}
              className="w-5 h-5 rounded-full border-2 border-gray-600 hover:border-rose-400 flex-shrink-0 transition-colors"
            />
            <span className="flex-1 text-sm text-gray-200">{todo.text}</span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-400 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div className="border-t border-gray-800 my-1" />
            {done.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800/20 group"
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="w-5 h-5 rounded-full bg-emerald-500/30 border-2 border-emerald-500/50 flex-shrink-0 flex items-center justify-center"
                >
                  <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="flex-1 text-sm text-gray-500 line-through">{todo.text}</span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-gray-500 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
