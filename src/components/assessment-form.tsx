"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TECHNIQUE_CRITERIA, type TechniqueKey } from "@/lib/sheets/assessments";

type HandEye = "right" | "left";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AssessmentForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [participantName, setParticipantName] = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [eventDate, setEventDate] = useState(today());
  const [strongHand, setStrongHand] = useState<HandEye | undefined>();
  const [strongEye, setStrongEye] = useState<HandEye | undefined>();
  const [technique, setTechnique] = useState<Partial<Record<TechniqueKey, boolean>>>({});
  const [notes, setNotes] = useState("");

  function setTech(key: TechniqueKey, value: boolean) {
    setTechnique((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  }

  const ratedCount = Object.keys(technique).length;
  const passCount = Object.values(technique).filter(Boolean).length;

  async function handleSubmit() {
    if (!participantName.trim()) {
      toast.error("יש להזין שם משתתף");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_name: participantName.trim(),
          participant_phone: participantPhone.trim(),
          event_date: eventDate,
          strong_hand: strongHand,
          strong_eye: strongEye,
          technique,
          notes: notes.trim(),
        }),
      });
      if (!r.ok) throw new Error("failed");
      toast.success("הדוח נשמר");
      router.push("/coach/assessments");
    } catch {
      toast.error("שגיאה בשמירת הדוח");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl flex flex-col gap-5">

      {/* Participant info */}
      <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">פרטי משתתף</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">שם מלא *</Label>
            <Input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="שם המשתתף"
              dir="rtl"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">טלפון</Label>
            <Input
              value={participantPhone}
              onChange={(e) => setParticipantPhone(e.target.value)}
              placeholder="05X-XXXXXXX"
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">תאריך האירוע</Label>
          <input
            type="date"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </section>

      {/* Player attributes */}
      <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-4 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">מאפייני השחקן</p>
        <div className="grid grid-cols-2 gap-4">
          <HandEyePicker label="יד חזקה" value={strongHand} onChange={setStrongHand} />
          <HandEyePicker label="עין חזקה" value={strongEye} onChange={setStrongEye} />
        </div>
      </section>

      {/* Technique */}
      <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">טכניקה</p>
          {ratedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {passCount}/{ratedCount} ✓
            </span>
          )}
        </div>
        <div className="flex flex-col divide-y divide-border/40">
          {TECHNIQUE_CRITERIA.map((c) => {
            const val = technique[c.key];
            return (
              <div key={c.key} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-sm text-right flex-1">{c.label}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTech(c.key, true)}
                    className={cn(
                      "h-8 w-8 rounded-lg border text-sm font-bold transition-all duration-150 flex items-center justify-center",
                      val === true
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                        : "border-border/60 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600"
                    )}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTech(c.key, false)}
                    className={cn(
                      "h-8 w-8 rounded-lg border text-sm font-bold transition-all duration-150 flex items-center justify-center",
                      val === false
                        ? "bg-red-500 border-red-500 text-white shadow-sm"
                        : "border-border/60 text-muted-foreground hover:border-red-400 hover:text-red-600"
                    )}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">נקודות עיקריות לשיפור</p>
        <Textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="כתוב כאן את הנקודות העיקריות לשיפור..."
          className="resize-none text-sm leading-relaxed"
          dir="rtl"
        />
      </section>

      {/* Submit */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          ביטול
        </Button>
        <Button onClick={handleSubmit} disabled={saving || !participantName.trim()} className="min-w-28">
          {saving ? "שומר..." : "שמור דוח"}
        </Button>
      </div>
    </div>
  );
}

function HandEyePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HandEye | undefined;
  onChange: (v: HandEye) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-right">{label}</p>
      <div className="flex gap-2">
        {(["right", "left"] as HandEye[]).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange(side)}
            className={cn(
              "flex-1 py-2 rounded-xl border text-sm font-medium transition-all duration-150",
              value === side
                ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {side === "right" ? "ימין" : "שמאל"}
          </button>
        ))}
      </div>
    </div>
  );
}
