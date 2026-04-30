export type NavItem = { href: string; label: string; icon: string };

export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/guidelines", label: "הנחיות", icon: "BookOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/guidelines", label: "הנחיות", icon: "BookOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
