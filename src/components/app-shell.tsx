"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LogOut, Sun, Moon, LayoutGrid, X,
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Tag, Target, Trophy, User, Users, UsersRound,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Tag, Target, Trophy, User, Users, UsersRound,
};
import { useTheme } from "next-themes";
import type { NavItem } from "./nav-items";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const BOTTOM_NAV_COUNT = 4;

export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const quickItems = items.slice(0, BOTTOM_NAV_COUNT);
  const hasMore = items.length > BOTTOM_NAV_COUNT;

  return (
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col shrink-0 bg-sidebar border-l border-sidebar-border relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/60 to-transparent" />

        <div className="p-4 pb-2">
          <div className="bg-brand-gradient rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-lg shadow-primary/20">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-white/30 blur-md scale-110" />
              <Image
                src="/logo.png"
                alt="לוגו אקדמיית סנוקר"
                width={38}
                height={38}
                className="relative object-contain drop-shadow-sm"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-white tracking-wide">האקדמיה לסנוקר</div>
              <div className="text-[11px] text-white/60 font-medium">של שחר רוברג</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {items.map((it, i) => (
            <NavLink
              key={it.href}
              item={it}
              active={isActiveRoute(pathname, it.href)}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </nav>

        <div className="p-3">
          <div className="h-px bg-sidebar-border mb-3" />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/35 hover:bg-sidebar-accent hover:text-sidebar-foreground/70 transition-all duration-200 group"
            >
              <LogOut size={15} strokeWidth={2} className="group-hover:text-destructive transition-colors" />
              <span>התנתקות</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-32 md:pb-4 min-w-0 animate-fade-in">
        {children}
      </main>

      {/* Mobile bottom nav — floating pill */}
      <div
        className="fixed bottom-0 inset-x-0 md:hidden pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <nav className="mx-3 mb-3 pointer-events-auto bg-background/95 backdrop-blur-2xl border border-border/50 rounded-2xl flex justify-around shadow-2xl shadow-black/15">
          {quickItems.map((it) => (
            <NavLink key={it.href} item={it} active={isActiveRoute(pathname, it.href)} compact />
          ))}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col flex-1 items-center gap-0.5 py-2.5 px-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <span className="w-10 h-8 rounded-xl flex items-center justify-center">
                <LayoutGrid size={20} strokeWidth={1.75} />
              </span>
              <span className="leading-none">עוד</span>
            </button>
          )}
        </nav>
      </div>

      {/* "More" full-menu drawer */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-background rounded-t-3xl border-t border-border/50 shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm font-semibold text-foreground/70">תפריט</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3" />

            {/* All nav items in a grid */}
            <div className="grid grid-cols-4 gap-1 px-3 pb-4">
              {items.map((it) => {
                const Icon = ICON_MAP[it.icon];
                const active = isActiveRoute(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl text-[10px] text-center transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {Icon && <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />}
                    <span className="leading-tight">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function isActiveRoute(pathname: string, href: string) {
  const segments = href.split("/").filter(Boolean);
  if (segments.length <= 1) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="w-9 h-9 flex items-center justify-center rounded-xl text-sidebar-foreground/35 hover:bg-sidebar-accent hover:text-sidebar-foreground/70 transition-all duration-200 shrink-0"
      aria-label="החלף מצב תצוגה"
    >
      <Sun size={15} className="hidden dark:block" />
      <Moon size={15} className="block dark:hidden" />
    </button>
  );
}

function NavLink({
  item,
  active,
  compact,
  style,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const Icon = ICON_MAP[item.icon];

  if (compact) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex flex-col flex-1 items-center gap-0.5 py-2.5 px-1 text-[10px] transition-all duration-200 relative",
          active ? "text-primary font-semibold" : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <span className={cn(
          "w-10 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
          active && "bg-primary/12 dark:bg-primary/15 shadow-sm",
        )}>
          {Icon && (
            <Icon
              size={active ? 22 : 20}
              strokeWidth={active ? 2.5 : 1.75}
            />
          )}
        </span>
        <span className="leading-none">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      style={style}
      className={cn(
        "animate-fade-in-up flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative group",
        active
          ? "bg-sidebar-primary/12 text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/45 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/80",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-sidebar-primary shadow-[0_0_8px_oklch(0.72_0.22_145/0.5)]" />
      )}
      {Icon && (
        <Icon
          size={16}
          strokeWidth={active ? 2.5 : 1.75}
          className={cn(
            "transition-all duration-200 shrink-0",
            active ? "text-sidebar-primary" : "group-hover:text-sidebar-foreground/70",
          )}
        />
      )}
      <span className="truncate">{item.label}</span>
      {!active && (
        <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-sidebar-primary/0 via-sidebar-primary/5 to-sidebar-primary/0" />
      )}
    </Link>
  );
}
