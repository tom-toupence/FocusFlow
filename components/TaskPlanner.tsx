"use client";

import { useState } from "react";
import { useSessionStore, Todo, TodoPriority } from "@/store/sessionStore";
import TodoStatusDropdown from "@/components/TodoStatusDropdown";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDate(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function formatDueDate(date: string): { label: string; overdue: boolean; today: boolean } {
  const today = localDate();
  const tom = tomorrow();
  if (date < today) return { label: "En retard", overdue: true, today: false };
  if (date === today) return { label: "Aujourd'hui", overdue: false, today: true };
  if (date === tom) return { label: "Demain", overdue: false, today: false };
  const d = new Date(date + "T00:00:00");
  return {
    label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    overdue: false,
    today: false,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "bg-red-500", text: "text-red-400", ring: "ring-red-500/30" },
  normal: { label: "Normal", color: "bg-amber-400", text: "text-amber-400", ring: "ring-amber-400/30" },
  low:    { label: "Faible", color: "bg-foreground/20", text: "text-foreground/35", ring: "ring-foreground/20" },
} as const;

function PriorityDot({ priority }: { priority?: TodoPriority }) {
  const p = priority ?? "normal";
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-0.5", PRIORITY_CONFIG[p].color)} />;
}

function DueDateChip({ dueDate }: { dueDate?: string }) {
  if (!dueDate) return null;
  const { label, overdue, today } = formatDueDate(dueDate);
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0",
      overdue ? "bg-red-500/15 text-red-400" :
      today   ? "bg-blue-500/15 text-blue-400" :
                "bg-foreground/8 text-foreground/40"
    )}>
      {label}
    </span>
  );
}

function PomodoroChip({ estimate, used }: { estimate?: number; used?: number }) {
  const est = estimate ?? 1;
  const u = used ?? 0;
  return (
    <span className="text-[10px] text-foreground/30 flex items-center gap-0.5 flex-shrink-0">
      🍅 <span className={cn(u > 0 && "text-foreground/60")}>{u > 0 ? `${u}/` : ""}{est}</span>
    </span>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateTodoForm({ onCreated }: { onCreated?: () => void }) {
  const { addTodo } = useSessionStore();
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = () => {
    const t = text.trim();
    if (!t) return;
    addTodo(t, {
      priority,
      dueDate: dueDate || undefined,
      pomodoroEstimate: estimate,
    });
    setText("");
    setPriority("normal");
    setDueDate("");
    setEstimate(1);
    setExpanded(false);
    onCreated?.();
  };

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-foreground/20 flex-shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSubmit(); if (e.key === "Escape") { setExpanded(false); setText(""); } }}
          placeholder="Nouvelle tâche…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/25 focus:outline-none"
        />
        {text.trim() && (
          <button
            onClick={handleSubmit}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/60 hover:text-foreground transition-all flex-shrink-0"
          >
            Ajouter
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap border-t border-foreground/[0.05] pt-2.5">
          {/* Priority */}
          <div className="flex items-center gap-1">
            {(["urgent", "normal", "low"] as TodoPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-all border",
                  priority === p
                    ? cn("border-foreground/20 bg-foreground/10", PRIORITY_CONFIG[p].text)
                    : "border-transparent text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_CONFIG[p].color)} />
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>

          {/* Due date */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDueDate(dueDate === localDate() ? "" : localDate())}
              className={cn(
                "text-[11px] px-2 py-1 rounded-lg border transition-all",
                dueDate === localDate()
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  : "border-transparent text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5"
              )}
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={() => setDueDate(dueDate === tomorrow() ? "" : tomorrow())}
              className={cn(
                "text-[11px] px-2 py-1 rounded-lg border transition-all",
                dueDate === tomorrow()
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  : "border-transparent text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5"
              )}
            >
              Demain
            </button>
            <input
              type="date"
              value={dueDate}
              min={localDate()}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg border border-transparent bg-foreground/5 text-foreground/40 focus:outline-none focus:border-foreground/20 w-[110px]"
            />
          </div>

          {/* Estimate */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-foreground/30">🍅</span>
            {[1, 2, 3, 4, 6, 8].map((n) => (
              <button
                key={n}
                onClick={() => setEstimate(n)}
                className={cn(
                  "w-6 h-6 rounded-md text-[11px] font-medium transition-all",
                  estimate === n
                    ? "bg-foreground/15 text-foreground"
                    : "text-foreground/30 hover:bg-foreground/8 hover:text-foreground/60"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ todo }: { todo: Todo }) {
  const { setTodoStatus, deleteTodo } = useSessionStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const { updateTodo } = useSessionStore();

  const saveEdit = () => {
    const t = editText.trim();
    if (t && t !== todo.text) updateTodo(todo.id, { text: t });
    setEditing(false);
  };

  return (
    <div className={cn(
      "flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/[0.03] group transition-colors",
      todo.status === "done" && "opacity-50"
    )}>
      <PriorityDot priority={todo.priority} />
      <TodoStatusDropdown status={todo.status} onChange={(s) => setTodoStatus(todo.id, s)} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { setEditText(todo.text); setEditing(false); } }}
            onBlur={saveEdit}
            className="w-full bg-foreground/8 border border-foreground/20 rounded-lg px-2 py-0.5 text-sm text-foreground focus:outline-none focus:border-foreground/35"
          />
        ) : (
          <p
            className={cn("text-sm text-foreground cursor-pointer", todo.status === "done" && "line-through text-foreground/40")}
            onDoubleClick={() => { setEditText(todo.text); setEditing(true); }}
          >
            {todo.text}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <DueDateChip dueDate={todo.dueDate} />
          <PomodoroChip estimate={todo.pomodoroEstimate} used={todo.pomodorosUsed} />
        </div>
      </div>

      <button
        onClick={() => deleteTodo(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-foreground/25 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, action }: { label: string; count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1 px-1">
      <span className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-foreground/25">{count}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ todos }: { todos: Todo[] }) {
  const active = todos.filter((t) => t.status !== "done");
  const urgent = active.filter((t) => (t.priority ?? "normal") === "urgent").length;
  const today = localDate();
  const overdue = active.filter((t) => t.dueDate && t.dueDate < today).length;
  const dueToday = active.filter((t) => t.dueDate === today).length;

  if (todos.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-foreground/30 px-1 mb-6">
      <span>{active.length} tâche{active.length !== 1 ? "s" : ""} actives</span>
      {urgent > 0 && <span className="text-red-400">· {urgent} urgente{urgent !== 1 ? "s" : ""}</span>}
      {overdue > 0 && <span className="text-red-400">· {overdue} en retard</span>}
      {dueToday > 0 && <span className="text-blue-400">· {dueToday} aujourd&apos;hui</span>}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type Filter = "all" | "urgent" | "today" | "overdue";

function FilterBar({ filter, setFilter }: { filter: Filter; setFilter: (f: Filter) => void }) {
  const opts: { value: Filter; label: string }[] = [
    { value: "all", label: "Tout" },
    { value: "urgent", label: "Urgent" },
    { value: "today", label: "Aujourd'hui" },
    { value: "overdue", label: "En retard" },
  ];
  return (
    <div className="flex gap-1 mb-6 flex-wrap">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => setFilter(o.value)}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium transition-all",
            filter === o.value
              ? "bg-foreground/15 text-foreground"
              : "bg-foreground/5 text-foreground/35 hover:text-foreground/60 hover:bg-foreground/8"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskPlanner() {
  const { todos, clearDone } = useSessionStore();
  const [filter, setFilter] = useState<Filter>("all");

  const today = localDate();

  function applyFilter(list: Todo[]): Todo[] {
    switch (filter) {
      case "urgent":  return list.filter((t) => (t.priority ?? "normal") === "urgent");
      case "today":   return list.filter((t) => t.dueDate === today);
      case "overdue": return list.filter((t) => t.dueDate && t.dueDate < today);
      default:        return list;
    }
  }

  const activeTodos  = applyFilter(todos.filter((t) => t.status !== "done"));
  const doneTodos    = filter === "all" ? todos.filter((t) => t.status === "done") : [];

  const todo       = activeTodos.filter((t) => t.status === "todo");
  const inProgress = activeTodos.filter((t) => t.status === "in-progress");

  // Sort: urgent first, then by due date
  const sortTodos = (list: Todo[]) =>
    [...list].sort((a, b) => {
      const pOrder: Record<TodoPriority, number> = { urgent: 0, normal: 1, low: 2 };
      const pa = pOrder[a.priority ?? "normal"];
      const pb = pOrder[b.priority ?? "normal"];
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  const groupedTodo = sortTodos(todo);
  const groupedInProgress = sortTodos(inProgress);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">Planifier</h1>
        <p className="text-foreground/40 mt-1 text-sm">Organise tes tâches, définis les priorités et suis ta progression.</p>
      </div>

      <StatsBar todos={todos} />

      <FilterBar filter={filter} setFilter={setFilter} />

      {/* Create */}
      <div className="mb-8">
        <CreateTodoForm />
      </div>

      {/* In progress */}
      {groupedInProgress.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="En cours" count={groupedInProgress.length} />
          <div className="space-y-0.5">
            {groupedInProgress.map((t) => (
              <TaskRow key={t.id} todo={t} />
            ))}
          </div>
        </div>
      )}

      {/* To do */}
      {groupedTodo.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="À faire" count={groupedTodo.length} />
          <div className="space-y-0.5">
            {groupedTodo.map((t) => (
              <TaskRow key={t.id} todo={t} />
            ))}
          </div>
        </div>
      )}

      {activeTodos.length === 0 && filter !== "all" && (
        <p className="text-foreground/25 text-sm text-center py-12">Aucune tâche dans ce filtre.</p>
      )}

      {todos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-foreground/25 text-sm">Aucune tâche pour l&apos;instant.</p>
          <p className="text-foreground/15 text-xs mt-1">Commence par créer ta première tâche ci-dessus.</p>
        </div>
      )}

      {/* Done */}
      {doneTodos.length > 0 && (
        <div className="mt-8">
          <div className="h-px bg-foreground/[0.06] mb-4" />
          <SectionHeader
            label="Terminées"
            count={doneTodos.length}
            action={
              <button
                onClick={clearDone}
                className="text-[11px] text-foreground/25 hover:text-foreground/50 transition-colors"
              >
                Effacer tout
              </button>
            }
          />
          <div className="space-y-0.5">
            {doneTodos.slice(0, 10).map((t) => (
              <TaskRow key={t.id} todo={t} />
            ))}
            {doneTodos.length > 10 && (
              <p className="text-[11px] text-foreground/25 px-3 py-1">
                +{doneTodos.length - 10} tâches terminées masquées
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
