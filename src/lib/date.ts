import { format, parseISO, addDays } from "date-fns";

export function todayIsoTel(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

export function formatHebrewDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(parseISO(iso));
}

export function weekRangeFor(iso: string) {
  const d = parseISO(iso);
  const dow = d.getDay(); // 0=Sun
  const start = addDays(d, -dow);
  const end = addDays(start, 6);
  return {
    startIso: format(start, "yyyy-MM-dd"),
    endIso: format(end, "yyyy-MM-dd"),
  };
}

export function dayLabelHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    timeZone: "Asia/Jerusalem",
  }).format(parseISO(iso));
}
