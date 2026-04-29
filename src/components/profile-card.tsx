"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>פרופיל</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="text-sm text-muted-foreground">דוא״ל</div>
            <div className="font-mono">{email}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">תפקיד</div>
            <div>{role === "admin" ? "מנהל" : "מאמן"}</div>
          </div>
          <Button variant="outline" onClick={signOut}>
            התנתקות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
