// Minimal RFC 5545 iCalendar builder — no dependencies.

export interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  // All-day event: `{ date: "2026-04-20" }`
  // Timed event:   `{ start: Date, end: Date }`
  start: Date | { date: string };
  end?: Date | { date: string };
  status?: "CONFIRMED" | "CANCELLED";
  url?: string;
}

// RFC 5545 §3.3.11 — escape TEXT values
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 §3.1 — fold long lines at 75 octets
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = i === 0 ? line.slice(0, 75) : " " + line.slice(i, i + 74);
    parts.push(chunk);
    i += i === 0 ? 75 : 74;
  }
  return parts.join("\r\n");
}

function formatUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → YYYYMMDD
  return iso.replace(/-/g, "");
}

function line(key: string, value: string): string {
  return fold(`${key}:${value}`);
}

function lineParams(key: string, params: string, value: string): string {
  return fold(`${key};${params}:${value}`);
}

export function buildIcs(calendarName: string, events: CalendarEvent[]): string {
  const now = formatUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GitMyDayTime//GMD Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(line("UID", ev.uid));
    lines.push(line("DTSTAMP", now));

    if (ev.start instanceof Date) {
      lines.push(line("DTSTART", formatUtc(ev.start)));
      if (ev.end instanceof Date) lines.push(line("DTEND", formatUtc(ev.end)));
    } else {
      lines.push(lineParams("DTSTART", "VALUE=DATE", formatDate(ev.start.date)));
      if (ev.end && !(ev.end instanceof Date)) {
        lines.push(lineParams("DTEND", "VALUE=DATE", formatDate(ev.end.date)));
      }
    }

    lines.push(line("SUMMARY", escapeText(ev.summary)));
    if (ev.description) lines.push(line("DESCRIPTION", escapeText(ev.description)));
    if (ev.url) lines.push(line("URL", ev.url));
    if (ev.status) lines.push(line("STATUS", ev.status));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
