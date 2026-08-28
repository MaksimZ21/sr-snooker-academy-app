"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Assessment } from "@/lib/sheets/assessment-types";

type WhatsAppGroup = { id: string; name: string };

async function fetchMasterClassGroups(): Promise<WhatsAppGroup[]> {
  const r = await fetch("/api/whatsapp/groups");
  if (!r.ok) throw new Error("failed to load groups");
  const { groups } = (await r.json()) as { groups: WhatsAppGroup[] };
  return groups.filter((g) =>
    g.name.includes("מאסטר קלאס") || g.name.toLowerCase().includes("master class"),
  );
}

async function sendToParticipant(a: Assessment) {
  if (!a.participant_phone) return;
  try {
    const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
    if (!tokenRes.ok) throw new Error();
    const { token } = (await tokenRes.json()) as { token: string };
    const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: a.participant_phone,
        urlFile: pdfUrl,
        fileName: `דוח אבחון - ${a.participant_name}.pdf`,
        caption: `שלום ${a.participant_name}, דוח האבחון שלך נמצא כאן`,
      }),
    });
    if (!r.ok) throw new Error();
    toast.success("נשלח ב-WhatsApp");
  } catch {
    toast.error("שגיאה בשליחה");
  }
}

async function sendToGroup(a: Assessment, group: WhatsAppGroup) {
  const toastId = toast.loading(`שולח ל${group.name}...`);
  try {
    const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
    if (!tokenRes.ok) throw new Error();
    const { token } = (await tokenRes.json()) as { token: string };
    const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: group.id,
        urlFile: pdfUrl,
        fileName: `דוח אבחון - ${a.participant_name}.pdf`,
        caption: `דוח אבחון - ${a.participant_name}`,
      }),
    });
    if (!r.ok) throw new Error();
    toast.success(`נשלח ל${group.name}`, { id: toastId });
  } catch {
    toast.error("שגיאה בשליחה", { id: toastId });
  }
}

export function AssessmentSendMenu({ assessment: a }: { assessment: Assessment }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: groups, isLoading, isError } = useQuery({
    queryKey: ["whatsapp:masterClassGroups"],
    queryFn: fetchMasterClassGroups,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isError) toast.error("שגיאה בטעינת קבוצות");
  }, [isError]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
        title="שלח ב-WhatsApp"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Send size={14} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-72 bg-popover border border-border/60 rounded-2xl shadow-lg overflow-hidden z-50"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {a.participant_phone && (
            <button
              type="button"
              onClick={() => { setOpen(false); sendToParticipant(a); }}
              className="w-full text-right flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-sm"
            >
              <Send size={14} className="text-emerald-500 shrink-0" />
              <span className="flex-1 truncate">שלח למשתתף</span>
            </button>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-4 border-t border-border/40 first:border-t-0">
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border/40 first:border-t-0">
              שגיאה בטעינת קבוצות
            </p>
          ) : groups && groups.length > 0 ? (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => { setOpen(false); sendToGroup(a, g); }}
                className="w-full text-right flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-sm border-t border-border/40 first:border-t-0"
              >
                <Users size={14} className="text-emerald-500 shrink-0" />
                <span className="flex-1 break-words">{g.name}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border/40 first:border-t-0">
              לא נמצאו קבוצות מאסטר קלאס
            </p>
          )}
        </div>
      )}
    </div>
  );
}
