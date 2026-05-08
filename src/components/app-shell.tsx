"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import type { NavItem } from "./nav-items";

export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* Dark navy sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col p-3 shrink-0 bg-sidebar">
        <div className="flex items-center gap-3 px-3 py-4">
          <Image
            src="/logo.png"
            alt="לוגו אקדמיית סנוקר"
            width={80}
            height={50}
            className="shrink-0 object-contain"
          />
          <div className="leading-tight">
            <div className="text-sm font-bold text-sidebar-foreground">אקדמיית סנוקר</div>
            <div className="text-xs text-sidebar-foreground/50">ניהול אקדמיה</div>
          </div>
        </div>
        <div className="h-px bg-sidebar-border mx-2 mb-3" />
        <nav className="flex flex-col gap-0.5 flex-1">
          {items.map((it) => (
            <NavLink key={it.href} item={it} active={isActiveRoute(pathname, it.href)} />
          ))}
        </nav>
      </aside>

      <main className="flex-1 pb-20 md:pb-4 min-w-0">{children}</main>

      {/* Mobile bottom nav — stays light */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-background/95 backdrop-blur-md border-t flex justify-around">
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
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[item.icon];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-lg transition-all duration-150",
        compact
          ? "flex-col flex-1 gap-1 px-1 py-2.5 text-xs justify-center"
          : "gap-2.5 px-3 py-2.5 text-sm",
        active
          ? compact
            ? "text-primary font-semibold"
            : "bg-sidebar-accent text-sidebar-primary font-semibold"
          : compact
            ? "text-muted-foreground hover:text-foreground"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {Icon && (
        <Icon
          size={compact ? 21 : 18}
          strokeWidth={active ? 2.5 : 2}
        />
      )}
      <span>{item.label}</span>
    </Link>
  );
}
