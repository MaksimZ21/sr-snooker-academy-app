// `section` starts a new labelled group in the sidebar (the items after it
// belong to it until the next one).
export type NavItem = { href: string; label: string; icon: string; section?: string };

export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/sessions", label: "האימונים שלי", icon: "History" },
  { href: "/coach/students", label: "מתאמנים", icon: "Users" },
  { href: "/coach/tournaments", label: "טורנירים", icon: "Trophy", section: "תחרויות" },
  { href: "/coach/leagues", label: "ליגות", icon: "Shield" },
  { href: "/coach/salary", label: "פיננסים", icon: "Banknote", section: "שלי" },
  { href: "/coach/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/coach/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "האימונים שלי", icon: "Calendar" },
  { href: "/student/tournaments", label: "הטורנירים שלי", icon: "Trophy" },
  { href: "/student/goal", label: "המטרה שלי", icon: "Target" },
  { href: "/student/history", label: "היסטוריה", icon: "History" },
  { href: "/student/contact", label: "פנייה לאדמין", icon: "MessageSquare" },
  { href: "/student/profile", label: "פרופיל", icon: "User" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap", section: "אנשים" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/players", label: "שחקנים", icon: "Award" },
  { href: "/admin/tournaments", label: "טורנירים", icon: "Trophy", section: "תחרויות" },
  { href: "/admin/leagues", label: "ליגות", icon: "Shield" },
  { href: "/admin/messages", label: "פניות", icon: "MessageSquare", section: "קשר ושיווק" },
  { href: "/admin/intro-events", label: "אירועי היכרות", icon: "UserPlus" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { href: "/admin/salary", label: "פיננסים", icon: "Banknote", section: "ניהול" },
  { href: "/admin/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/webhook-logs", label: "לוגים CRM", icon: "Activity" },
  { href: "/admin/settings", label: "הגדרות", icon: "Settings" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
