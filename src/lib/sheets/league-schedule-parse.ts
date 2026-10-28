// Pure and client-safe (no db import): turns the weekly league schedule an
// external AI produces into match assignments, and builds the text the
// admin gives that AI. See
// docs/superpowers/specs/2026-10-28-league-weekly-schedule-design.md.

export type ScheduleParticipant = { id: string; name: string };

export type ScheduleMatch = {
  id: string;
  district_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  scheduled_date: string | null;
};

export type ScheduleLineResult =
  | { raw: string; ok: true; matchId: string; date: string; districtId: string; movedFrom: string | null }
  | { raw: string; ok: false; error: string };

export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// "2.11", "2/11", "2.11.2026", "2.11.26", anywhere in the text. With no
// year, picks whichever of last/this/next year lands closest to today, so
// a schedule pasted in late December for early January gets next year.
export function parseScheduleDate(text: string, todayIso: string): string | null {
  const m = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2})(?!\d))?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);

  if (m[3]) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null;
  }

  const todayYear = Number(todayIso.slice(0, 4));
  const todayMs = Date.UTC(todayYear, Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)));
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const year of [todayYear - 1, todayYear, todayYear + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const diff = Math.abs(Date.UTC(year, month - 1, day) - todayMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = `${year}-${pad(month)}-${pad(day)}`;
    }
  }
  return best;
}

function normalizeName(s: string): string {
  return s.replace(/["'״׳]/g, "").replace(/\s+/g, " ").trim();
}

function findParticipant(
  input: string,
  participants: ScheduleParticipant[],
): { ok: true; id: string } | { ok: false; error: string } {
  const name = normalizeName(input);
  const exact = participants.filter((p) => normalizeName(p.name) === name);
  if (exact.length === 1) return { ok: true, id: exact[0].id };
  if (exact.length > 1) return { ok: false, error: `שם לא חד-משמעי: ${name}` };

  const byFirstName = participants.filter((p) => normalizeName(p.name).split(" ")[0] === name);
  if (byFirstName.length === 1) return { ok: true, id: byFirstName[0].id };
  if (byFirstName.length > 1) return { ok: false, error: `שם לא חד-משמעי: ${name}` };

  return { ok: false, error: `שם לא נמצא: ${name}` };
}

// One result per line containing "|" (everything else — headings, blank
// lines — is ignored). Lines are resolved in order, and a match used by an
// earlier line can't be used again.
export function resolveSchedulePaste(
  text: string,
  participants: ScheduleParticipant[],
  matches: ScheduleMatch[],
  todayIso: string,
): ScheduleLineResult[] {
  const used = new Set<string>();
  const results: ScheduleLineResult[] = [];

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    const bar = raw.indexOf("|");
    if (!raw || bar === -1) continue;

    const date = parseScheduleDate(raw.slice(0, bar), todayIso);
    if (!date) {
      results.push({ raw, ok: false, error: "תאריך לא תקין" });
      continue;
    }

    const names = raw
      .slice(bar + 1)
      .split(/\s+(?:-|–|—|נגד)\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length !== 2) {
      results.push({ raw, ok: false, error: 'צריך שני שמות מופרדים ב-" - "' });
      continue;
    }

    const a = findParticipant(names[0], participants);
    if (!a.ok) {
      results.push({ raw, ok: false, error: a.error });
      continue;
    }
    const b = findParticipant(names[1], participants);
    if (!b.ok) {
      results.push({ raw, ok: false, error: b.error });
      continue;
    }
    if (a.id === b.id) {
      results.push({ raw, ok: false, error: "אותו שחקן משני הצדדים" });
      continue;
    }

    const open = matches.filter(
      (m) =>
        m.frames_a === null &&
        ((m.participant_a_id === a.id && m.participant_b_id === b.id) ||
          (m.participant_a_id === b.id && m.participant_b_id === a.id)),
    );
    const free = open.filter((m) => !used.has(m.id));
    if (free.length === 0) {
      results.push({
        raw,
        ok: false,
        error: open.length > 0 ? "המשחק כבר מופיע בשורה קודמת" : "אין משחק פתוח ביניהם",
      });
      continue;
    }

    // A match scheduled earlier but never played gets moved to the new day.
    const pick =
      free.find((m) => !m.scheduled_date) ??
      [...free].sort((x, y) => (x.scheduled_date ?? "").localeCompare(y.scheduled_date ?? ""))[0];
    used.add(pick.id);
    results.push({
      raw,
      ok: true,
      matchId: pick.id,
      date,
      districtId: pick.district_id,
      movedFrom: pick.scheduled_date && pick.scheduled_date !== date ? pick.scheduled_date : null,
    });
  }

  return results;
}

// The block the admin copies into the AI alongside the availability poll:
// the format instruction travels with the data, so there's no separate
// prompt to keep in sync with this parser.
export function buildOpenMatchesText(
  leagueName: string,
  districts: { label: string; matches: ScheduleMatch[] }[],
  participants: ScheduleParticipant[],
): string {
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const lines = [
    `ליגה: ${leagueName}`,
    "",
    "החזר את הלוז לשבוע בפורמט הזה בלבד, שורה אחת לכל משחק:",
    "יום.חודש | שם מלא - שם מלא",
    "לדוגמה: 2.11 | דני כהן - יוסי לוי",
    "השתמש בשמות בדיוק כפי שהם כתובים למטה.",
    "",
    "משחקים שעוד לא שוחקו:",
  ];
  for (const d of districts) {
    const open = d.matches.filter((m) => m.frames_a === null);
    if (open.length === 0) continue;
    lines.push("", `${d.label}:`);
    for (const m of open) {
      const suffix = m.scheduled_date ? ` (משובץ ל-${shortDate(m.scheduled_date)})` : "";
      lines.push(`${nameOf.get(m.participant_a_id) ?? "?"} - ${nameOf.get(m.participant_b_id) ?? "?"}${suffix}`);
    }
  }
  return lines.join("\n");
}
