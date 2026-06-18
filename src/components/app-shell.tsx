"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import type { NavItem } from "./nav-items";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col shrink-0 bg-sidebar border-l border-sidebar-border relative">
        {/* Subtle green glow at top */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/50 to-transparent" />

        {/* Logo */}
        <div className="p-4 pb-2">
          <div className="bg-brand-gradient rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-lg">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-md" />
              <Image
                src="/logo.png"
                alt="לוגו אקדמיית סנוקר"
                width={38}
                height={38}
                className="relative shrink-0 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-white tracking-wide">אקדמיית סנוקר</div>
              <div className="text-[11px] text-white/60 font-medium">ניהול אקדמיה</div>
            </div>
          </div>
        </div>

        {/* Nav */}
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

        {/* Bottom */}
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

      <main className="flex-1 overflow-y-auto pb-20 md:pb-4 min-w-0 animate-fade-in">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-background/80 backdrop-blur-xl border-t border-border/60 flex justify-around safe-area-pb shadow-lg">
        {items.slice(0, 5).map((it) => (
          <NavLink key={it.href} item={it} active={isActiveRoute(pathname, it.href)} compact />
        ))}
      </nav>
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
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>>)[item.icon];

  if (compact) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex flex-col flex-1 items-center gap-1 px-1 py-2.5 text-[10px] transition-all duration-200 relative",
          active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {active && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
        )}
        {Icon && (
          <span className={cn("transition-transform duration-200", active && "scale-110")}>
            <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
          </span>
        )}
        <span>{item.label}</span>
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
          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/45 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/80",
      )}
    >
      {/* Active indicator line */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-sidebar-primary glow-sm" />
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

      {/* Hover shimmer */}
      {!active && (
        <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-sidebar-primary/0 via-sidebar-primary/5 to-sidebar-primary/0" />
      )}
    </Link>
  );
}
