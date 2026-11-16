"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    if (password.length < 6) { setError("סיסמה חייבת להכיל לפחות 6 תווים"); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    window.location.href = "/";
  }

  return (
    <main className="min-h-dvh grid place-items-center px-4 bg-brand-gradient">
      <Card className="w-full max-w-md bg-card shadow-2xl overflow-hidden py-0 gap-0">
        <div className="bg-sidebar text-white px-8 pt-7 pb-5 text-center flex flex-col items-center gap-2">
          <h1 className="bc-num text-[28px] md:text-[34px] leading-[1.05]">הגדרת סיסמה</h1>
          <p className="text-sm text-white/65">בחר סיסמה לכניסה למערכת</p>
          <span className="block h-[3px] w-14 bg-primary mt-1" />
        </div>
        <CardContent className="flex flex-col gap-6 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <Label>סיסמה חדשה</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div>
              <Label>אימות סיסמה</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
              {loading ? "שומר..." : "שמור והכנס"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
