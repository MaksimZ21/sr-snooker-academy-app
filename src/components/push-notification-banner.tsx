"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Some of the promises below (service worker readiness, above all) can hang
// forever instead of rejecting if something's wrong in the browser/PWA
// environment — with no console access on a phone, an infinite spinner and
// no error is the worst possible failure mode. Bound every await so a stuck
// step turns into a visible, specific error instead.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} — לא הגיב תוך ${ms / 1000} שניות`)), ms),
    ),
  ]);
}

// @serwist/next's <SerwistProvider> already registers the service worker on
// app load, but its register() call is fire-and-forget (`void ...register()`
// internally) — if it fails, nothing ever surfaces that. Registering again
// here explicitly is a safe no-op if it's already registered (the browser
// dedupes by script URL + scope), and — critically — lets us actually see
// the rejection if registration itself is what's failing, instead of just
// timing out later on `.ready` with no idea why.
async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  await withTimeout(navigator.serviceWorker.register("/sw.js", { scope: "/" }), 10_000, "רישום ה-Service Worker (register)");
  return withTimeout(navigator.serviceWorker.ready, 10_000, "הפעלת ה-Service Worker (ready)");
}

export function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void checkVisibility();
  }, []);

  async function checkVisibility() {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return;

    if (Notification.permission === "denied") {
      // The browser will never re-prompt — nothing this banner can do.
      setVisible(false);
      return;
    }
    if (Notification.permission === "default") {
      setVisible(true);
      return;
    }

    // Permission is already "granted", but that doesn't guarantee a working
    // subscription exists — e.g. it was granted before the VAPID keys were
    // configured, or a previous subscribe attempt failed after the OS-level
    // prompt. Since the browser won't ask again, re-check for an actual
    // subscription and keep offering the button until one truly exists.
    try {
      const registration = await getReadyRegistration();
      const existing = await registration.pushManager.getSubscription();
      setVisible(!existing);
    } catch {
      setVisible(false);
    }
  }

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("לא אושרה הרשאה להתראות");
        setVisible(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("שגיאת הגדרה: מפתח ההתראות חסר בשרת");
        return;
      }

      const registration = await getReadyRegistration();
      const subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }),
        10_000,
        "הרשמה להתראות בדפדפן",
      );
      const res = await withTimeout(
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        }),
        10_000,
        "שמירת ההרשמה בשרת",
      );
      if (!res.ok) throw new Error(`שרת החזיר שגיאה (${res.status})`);
      toast.success("התראות הופעלו בהצלחה");
      setVisible(false);
    } catch (err) {
      // Surface the actual error on-screen — this runs on phones with no
      // devtools access, so console.error alone is invisible to whoever's
      // debugging this live.
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`ההפעלה נכשלה: ${message}`);
      console.error("[push] subscribe failed", err);
      // Leave the banner visible so the admin can retry (e.g. transient
      // network error) instead of getting silently stuck forever.
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Bell size={18} className="text-primary shrink-0" />
      <p className="text-sm flex-1">הפעל התראות כדי לקבל התראה מיידית על פנייה חדשה מתאמן</p>
      <Button size="sm" onClick={enable} disabled={loading}>
        {loading ? "מפעיל..." : "הפעל התראות"}
      </Button>
    </div>
  );
}
