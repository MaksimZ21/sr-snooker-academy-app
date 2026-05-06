"use client";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const redirect = searchParams.get("redirect") ?? "/";
      router.push(redirect);
    }
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-3">
      <Input
        type="email"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        type="password"
        placeholder="סיסמה"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        dir="ltr"
      />
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
        {loading ? "מתחבר..." : "התחברות"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
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
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
