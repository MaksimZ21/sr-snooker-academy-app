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
      <aside className="hidden md:flex md:w-56 border-l p-4 flex-col gap-1">
        <div className="font-bold text-lg mb-4">אקדמיית סנוקר</div>
        {items.map((it) => (
          <NavLink key={it.href} item={it} active={pathname === it.href} />
        ))}
      </aside>
      <main className="flex-1 pb-20 md:pb-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-background border-t flex justify-around">
        {items.map((it) => (
          <NavLink key={it.href} item={it} active={pathname === it.href} compact />
        ))}
      </nav>
    </div>
  );
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
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[item.icon];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded p-2 text-sm",
        compact ? "flex-col flex-1 text-xs justify-center py-3" : "",
        active ? "text-primary font-semibold" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon size={compact ? 22 : 18} />}
      <span>{item.label}</span>
    </Link>
  );
}
