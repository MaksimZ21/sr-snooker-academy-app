"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
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
              {role === "admin" ? "מנהל" : "מאמן"}
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            התנתקות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
