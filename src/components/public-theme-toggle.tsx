"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// Dark / light switch for the public pages, sitting on the green hero.
export function PublicThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors ${className ?? ""}`}
      aria-label="החלף מצב תצוגה"
    >
      <Sun size={14} className="hidden dark:block" />
      <Moon size={14} className="block dark:hidden" />
      <span className="hidden dark:inline">מצב מואר</span>
      <span className="dark:hidden">מצב חשוך</span>
    </button>
  );
}
