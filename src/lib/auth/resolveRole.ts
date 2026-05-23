export type Role = "admin" | "coach" | "student" | "denied";

export function resolveRole(input: {
  email: string;
  adminEmails: string;
  activeCoachEmails: string[];
  activeStudentEmails: string[];
}): Role {
  const email = input.email.trim().toLowerCase();
  const admins = input.adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(email)) return "admin";
  const coaches = input.activeCoachEmails.map((e) => e.trim().toLowerCase());
  if (coaches.includes(email)) return "coach";
  const students = input.activeStudentEmails.map((e) => e.trim().toLowerCase());
  if (students.includes(email)) return "student";
  return "denied";
}
