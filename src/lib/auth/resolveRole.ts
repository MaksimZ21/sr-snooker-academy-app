export type Role = "admin" | "coach" | "denied";

export function resolveRole(input: {
  email: string;
  adminEmails: string;
  activeCoachEmails: string[];
}): Role {
  const email = input.email.trim().toLowerCase();
  const admins = input.adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(email)) return "admin";
  const coaches = input.activeCoachEmails.map((e) => e.trim().toLowerCase());
  if (coaches.includes(email)) return "coach";
  return "denied";
}
