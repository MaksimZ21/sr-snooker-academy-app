"use client";
import Link from "next/link";
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
      <aside className="hidden md:flex md:w-60 border-l bg-sidebar flex-col p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background text-sm font-bold shrink-0 shadow-sm">
            8
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">אקדמיית סנוקר</div>
            <div className="text-xs text-muted-foreground">ניהול אקדמיה</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1">
          {items.map((it) => (
            <NavLink key={it.href} item={it} active={isActiveRoute(pathname, it.href)} />
          ))}
        </nav>
      </aside>
      <main className="flex-1 pb-20 md:pb-4 min-w-0">{children}</main>
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
        "flex items-center rounded-lg transition-colors duration-150",
        compact
          ? "flex-col flex-1 gap-1 px-1 py-2.5 text-xs justify-center"
          : "gap-2.5 px-3 py-2.5 text-sm",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
