// iCalendar (.ics) generation for focus blocks — shared by the subscription
// feed (app/api/calendar/[token]) and the local download fallback.
// Events use floating local times (no TZID) so they show at the planned local
// hour on every device, plus a -10 min VALARM reminder.

/** Escapes a text value per RFC 5545 (commas, semicolons, backslashes, newlines). */
function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** "2026-06-10" + 540 → "20260610T090000" (floating local time). */
function icsDateTime(date: string, minOfDay: number): string {
  const h = Math.floor(minOfDay / 60);
  const m = minOfDay % 60;
  return `${date.replace(/-/g, "")}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

/** Folds lines longer than 75 octets per RFC 5545 §3.1. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export interface IcsBlock {
  id: string;
  date: string;       // YYYY-MM-DD
  startMin: number;   // minutes from midnight
  durationMin: number;
  label: string;
  done: boolean;
}

export function blocksToICS(blocks: IcsBlock[], calendarName = "FocusFlow — Planning"): string {
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}` +
    `T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FocusFlow//Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
  ];

  for (const b of blocks) {
    const summary = (b.label || "Focus") + (b.done ? " ✓" : "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@focusflow`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsDateTime(b.date, b.startMin)}`,
      `DTEND:${icsDateTime(b.date, b.startMin + b.durationMin)}`,
      `SUMMARY:${icsEscape(`🍅 ${summary}`)}`,
      `DESCRIPTION:${icsEscape("Bloc de focus planifié dans FocusFlow.")}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Ta session de focus commence bientôt",
      "TRIGGER:-PT10M",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Triggers a browser download of the given blocks as a .ics file. */
export function downloadICS(blocks: IcsBlock[], filename = "focusflow-planning.ics"): void {
  const blob = new Blob([blocksToICS(blocks)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
