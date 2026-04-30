"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-dvh grid place-items-center px-4 bg-brand-gradient">
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-4 left-4 flex gap-1.5 opacity-70">
          <span className="block w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span className="block w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="block w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </div>
        <CardContent className="flex flex-col gap-6 p-8 pt-12">
          <div className="text-center flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background text-base font-bold shadow">
                8
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                אקדמיית סנוקר
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              ניהול אימונים, נוכחות ומאמנים
            </p>
          </div>

          <p className="text-center text-muted-foreground text-sm">
            היכנס באמצעות חשבון Google
          </p>

          <div className="border-t border-border/60" />

          <Button
            onClick={signIn}
            disabled={loading}
            size="lg"
            className="w-full h-12 text-base"
          >
            {loading ? "מתחבר..." : "התחברות עם Google"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
