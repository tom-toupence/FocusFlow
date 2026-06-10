// Data export helpers — turn stored data into downloadable CSV / JSON files.

import { DayStats } from "@/store/statsStore";
import { PlayEntry } from "@/store/playHistoryStore";

function downloadBlob(content: string, filename: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** Exports daily focus stats as CSV. */
export function exportStatsCsv(days: Record<string, DayStats>) {
  const rows = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  const header = "date,sessions,minutes_worked";
  const body = rows.map((d) => `${d.date},${d.sessions},${d.minutesWorked}`).join("\n");
  downloadBlob(`${header}\n${body}\n`, `focusflow-stats-${todayStamp()}.csv`, "text/csv;charset=utf-8");
}

/** Exports the full play history as CSV. */
export function exportHistoryCsv(entries: PlayEntry[]) {
  const header = "date,type,title,subtitle,minutes";
  const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const body = entries
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e) => `${e.date},${e.type},${esc(e.title)},${esc(e.subtitle)},${e.minutes}`)
    .join("\n");
  downloadBlob(`${header}\n${body}\n`, `focusflow-history-${todayStamp()}.csv`, "text/csv;charset=utf-8");
}

/** Exports everything as a single JSON backup. */
export function exportAllJson(payload: {
  days: Record<string, DayStats>;
  history: PlayEntry[];
  distractions: Record<string, number>;
  achievements: Record<string, string>;
}) {
  const data = { exportedAt: new Date().toISOString(), ...payload };
  downloadBlob(JSON.stringify(data, null, 2), `focusflow-backup-${todayStamp()}.json`, "application/json");
}
