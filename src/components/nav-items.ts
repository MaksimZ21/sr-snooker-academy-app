export type NavItem = { href: string; label: string; icon: string };

export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/sessions", label: "האימונים שלי", icon: "History" },
  { href: "/coach/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
