"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
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
      const registration = await navigator.serviceWorker.ready;
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
        setVisible(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setVisible(false);
    } catch (err) {
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
