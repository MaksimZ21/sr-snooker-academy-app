// Client-safe. A player's name may be stored split ("דני" / "כהן") or whole
// in first_name ("דני כהן" / ""), so names are always compared whole.
function normalizeName(name: string): string {
  return name.replace(/["'״׳]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function isSameFullName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

export function hasStudentNamed(
  students: { first_name: string; last_name: string }[],
  name: string,
): boolean {
  return students.some((s) => isSameFullName(`${s.first_name} ${s.last_name}`, name));
}
