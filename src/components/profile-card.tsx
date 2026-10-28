"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "בהיר", Icon: Sun },
  { value: "dark", label: "כהה", Icon: Moon },
  { value: "system", label: "אוטומטי", Icon: Monitor },
] as const;

// The sidebar's theme button is desktop-only, so this is the only way to
// switch on mobile.
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-muted-foreground">מצב תצוגה</span>
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
  }
  function changePassword() {
    window.location.href = "/set-password";
  }
  return (
    <div className="p-4">
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient-soft h-20" />
        <CardContent className="-mt-10 flex flex-col items-center gap-4 pb-6">
          <Avatar className="h-20 w-20 ring-4 ring-background bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <div className="font-mono text-sm">{email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {role === "admin" ? "מנהל" : role === "student" ? "מתאמן" : "מאמן"}
            </div>
          </div>
          <ThemeSelector />
          <div className="flex gap-2">
            <Button variant="outline" onClick={changePassword}>
              שינוי סיסמה
            </Button>
            <Button variant="outline" onClick={signOut}>
              התנתקות
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
