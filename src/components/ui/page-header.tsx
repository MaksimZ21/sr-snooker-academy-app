import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, icon, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 px-4 pt-4 pb-4 border-b border-border/50",
      className,
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
