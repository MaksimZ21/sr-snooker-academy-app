"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";

function StaffLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      window.location.href = redirect;
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
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
        {loading ? "מתחבר..." : "התחברות"}
      </Button>
    </form>
  );
}

type OtpStep = "email" | "code";

function StudentLoginForm() {
  const [step, setStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
    setLoading(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/student";
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyOtp} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground text-center">
          שלחנו קוד ל-{email}
        </p>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="קוד בן 6 ספרות"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={6}
          dir="ltr"
          className="text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
          {loading ? "מאמת..." : "אימות"}
        </Button>
        <button
          type="button"
          onClick={() => setStep("email")}
          className="text-sm text-muted-foreground underline text-center"
        >
          שנה מייל
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendOtp} className="flex flex-col gap-3">
      <Input
        type="email"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        dir="ltr"
      />
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
        {loading ? "שולח קוד..." : "שלח קוד"}
      </Button>
    </form>
  );
}

type Tab = "staff" | "student";

function LoginTabs() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => setTab("student")}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>
      {tab === "staff" ? <StaffLoginForm /> : <StudentLoginForm />}
    </div>
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
            <div className="flex flex-col items-center gap-3">
              <Image
                src="/logo.png"
                alt="לוגו אקדמיית סנוקר"
                width={120}
                height={75}
                className="object-contain"
              />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                אקדמיית סנוקר
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              ניהול אימונים, נוכחות ומאמנים
            </p>
          </div>
          <Suspense>
            <LoginTabs />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
