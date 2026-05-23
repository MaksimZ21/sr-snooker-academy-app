"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { LogOut } from "lucide-react";
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
      <aside className="hidden md:flex md:w-64 flex-col shrink-0 bg-sidebar">
        {/* Logo */}
        <div className="p-4 pb-3">
          <div className="bg-brand-gradient rounded-xl px-4 py-3 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="לוגו אקדמיית סנוקר"
              width={42}
              height={42}
              className="shrink-0 object-contain"
            />
            <div className="leading-tight">
              <div className="text-sm font-bold text-white">אקדמיית סנוקר</div>
              <div className="text-xs text-white/65">ניהול אקדמיה</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 flex flex-col gap-0.5 overflow-y-auto">
          {items.map((it) => (
            <NavLink key={it.href} item={it} active={isActiveRoute(pathname, it.href)} />
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3">
          <div className="h-px bg-sidebar-border mb-3" />
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground/80 transition-all duration-150"
          >
            <LogOut size={16} strokeWidth={2} />
            <span>התנתקות</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-4 min-w-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-background/95 backdrop-blur-md border-t flex justify-around safe-area-pb">
        {items.map((it) => (
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

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>>)[item.icon];

  if (compact) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex flex-col flex-1 items-center gap-1 px-1 py-2.5 text-xs transition-colors duration-150 relative",
          active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {active && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
        )}
        {Icon && <Icon size={20} strokeWidth={active ? 2.5 : 2} />}
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      {Icon && (
        <Icon
          size={17}
          strokeWidth={active ? 2.5 : 2}
          className={cn(active ? "text-sidebar-primary" : "")}
        />
      )}
      <span>{item.label}</span>
    </Link>
  );
}
