"use client";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";

// StaffLoginForm kept for potential future use (password login)
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

type WaStep = "phone" | "code";

function WhatsAppLoginForm() {
  const [step, setStep] = useState<WaStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/whatsapp-otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await r.json();
    if (!r.ok) {
      setError(json.error ?? "שגיאה בשליחה");
    } else if (!json.token) {
      setError("המספר אינו רשום במערכת");
    } else {
      setToken(json.token);
      setStep("code");
    }
    setLoading(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/whatsapp-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, token }),
    });
    const json = await r.json();
    if (!r.ok) {
      setError(json.error ?? "קוד שגוי");
      setLoading(false);
    } else {
      window.location.href = json.actionLink;
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyOtp} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground text-center">
          שלחנו קוד ב-WhatsApp למספר {phone}
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
          autoFocus
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base bg-[#25D366] hover:bg-[#1ebe5c] text-white">
          {loading ? "מאמת..." : "כניסה"}
        </Button>
        <button
          type="button"
          onClick={() => { setStep("phone"); setCode(""); setError(null); }}
          className="text-sm text-muted-foreground underline text-center"
        >
          שנה מספר
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendOtp} className="flex flex-col gap-3">
      <Input
        type="tel"
        placeholder="מספר טלפון (054...)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        dir="ltr"
        autoFocus
      />
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base gap-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white">
        <MessageCircle size={18} />
        {loading ? "שולח..." : "שלח קוד ב-WhatsApp"}
      </Button>
    </form>
  );
}

type Tab = "staff" | "student";

function LoginTabs() {
  const [tab, setTab] = useState<Tab>("staff");
  const [showWa, setShowWa] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => { setTab("staff"); setShowWa(false); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => { setTab("student"); setShowWa(false); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>

      {tab === "staff" ? (
        <WhatsAppLoginForm />
      ) : showWa ? (
        <div className="flex flex-col gap-3">
          <WhatsAppLoginForm />
          <button
            type="button"
            onClick={() => setShowWa(false)}
            className="text-sm text-muted-foreground underline text-center"
          >
            חזור לכניסה עם אימייל
          </button>
        </div>
      ) : (
        <>
          <StudentLoginForm />
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">או</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-11 gap-2 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
            onClick={() => setShowWa(true)}
          >
            <MessageCircle size={17} />
            כניסה עם WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}

function HashSessionHandler() {
  const supabase = createSupabaseBrowserClient();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (!error) window.location.href = "/";
    });
  }, [supabase]);
  return null;
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
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-center">
                האקדמיה לסנוקר<br />של שחר רוברג
              </h1>
            </div>
          </div>
          <HashSessionHandler />
          <Suspense>
            <LoginTabs />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
