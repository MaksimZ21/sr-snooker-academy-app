import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  // Shown as-is in place of the dark icon box (e.g. logos).
  brand?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, icon, brand, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-5 pb-4 border-b border-border/60 bc-slide",
      // A short green rule under the title, like a TV lower third.
      "after:absolute after:bottom-[-1px] after:start-4 after:h-[3px] after:w-14 after:bg-primary",
      className,
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
        {brand}
        {!brand && icon && (
          <div className="h-11 w-11 rounded-xl bg-sidebar text-[#7ee2a4] flex items-center justify-center shrink-0 bc-slant">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="bc-num text-[24px] md:text-[32px] leading-[1.05] break-words">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
