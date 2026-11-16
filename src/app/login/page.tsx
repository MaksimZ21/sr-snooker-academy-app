"use client";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { AppSplash } from "@/components/app-splash";

// Rendered into body: the login card's backdrop-filter would otherwise trap
// the fixed-position splash inside the card.
function EnteringSplash() {
  return createPortal(<AppSplash message="מתחברים..." />, document.body);
}

function EmailPasswordLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
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
      setEntering(true);
      // replace, so the back button doesn't return to this page mid-splash.
      window.location.replace(searchParams.get("redirect") ?? "/");
    }
  }

  if (entering) return <EnteringSplash />;

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

type WaStep = "phone" | "code";

function WhatsAppLoginForm() {
  const [step, setStep] = useState<WaStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
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
      setEntering(true);
      window.location.replace(json.actionLink);
    }
  }

  if (entering) return <EnteringSplash />;

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
  const linkFailed = useSearchParams().get("error") === "link";
  const [tab, setTab] = useState<Tab>("staff");
  // Both staff and student default to WhatsApp. Each tab button resets to its own default.
  const [showWa, setShowWa] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      {linkFailed && (
        <p className="text-sm text-destructive text-center">הכניסה לא הושלמה. אפשר לנסות שוב.</p>
      )}
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => { setTab("staff"); setShowWa(true); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => { setTab("student"); setShowWa(true); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>

      {showWa ? (
        <div className="flex flex-col gap-3">
          <WhatsAppLoginForm />
          <button
            type="button"
            onClick={() => setShowWa(false)}
            className="text-sm text-muted-foreground underline text-center"
          >
            כניסה עם מייל וסיסמה
          </button>
        </div>
      ) : (
        <>
          <EmailPasswordLoginForm />
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
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;
    setEntering(true);
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setEntering(false);
      else window.location.replace("/");
    });
  }, [supabase]);
  return entering ? <EnteringSplash /> : null;
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 bg-brand-gradient">
      <Card className="w-full max-w-md bg-card shadow-2xl relative overflow-hidden py-0 gap-0">
        {/* Dark control-room band with the (white) logo */}
        <div className="bg-sidebar text-white px-8 pt-8 pb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="לוגו אקדמיית סנוקר"
            width={120}
            height={75}
            className="object-contain"
          />
          <h1 className="bc-num text-[30px] md:text-[36px] leading-tight">
            האקדמיה לסנוקר<br />של שחר רוברג
          </h1>
          <span className="block h-[3px] w-14 bg-primary" />
        </div>
        <CardContent className="flex flex-col gap-6 p-8">
          <HashSessionHandler />
          <Suspense>
            <LoginTabs />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
