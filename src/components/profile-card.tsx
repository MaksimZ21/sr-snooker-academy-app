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
    <div className="p-4 max-w-xl mx-auto w-full">
      <Card className="overflow-hidden py-0">
        <div className="bg-brand-gradient h-24" />
        <CardContent className="-mt-11 flex flex-col items-center gap-4 pb-6">
          <div className="h-[88px] w-[88px] rounded-2xl bg-sidebar text-[#7ee2a4] ring-4 ring-card flex items-center justify-center bc-num text-4xl bc-slant">
            {email[0]?.toUpperCase()}
          </div>
          <div className="text-center flex flex-col items-center gap-1.5">
            <div className="font-display text-base font-bold" dir="ltr">{email}</div>
            <span className="rounded-md bg-primary text-white px-2.5 py-0.5 font-display text-xs font-bold">
              {role === "admin" ? "מנהל" : role === "student" ? "מתאמן" : "מאמן"}
            </span>
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
