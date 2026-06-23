"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TECHNIQUE_CRITERIA, type TechniqueKey } from "@/lib/sheets/assessment-types";
import type { Phrase } from "@/lib/sheets/assessment-phrases";

type HandEye = "right" | "left";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AssessmentForm({ returnPath = "/coach/assessments" }: { returnPath?: string }) {
  const router      = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  /* Photo — stored as base64 data URL, never uploaded to storage */
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  /* Fields */
  const [participantName,  setParticipantName]  = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [eventDate,        setEventDate]        = useState(today());
  const [strongHand,       setStrongHand]       = useState<HandEye | undefined>();
  const [strongEye,        setStrongEye]        = useState<HandEye | undefined>();
  const [technique,        setTechnique]        = useState<Partial<Record<TechniqueKey, boolean>>>({});
  const [notes,            setNotes]            = useState("");

  /* Phrases */
  const [phrasesOpen,       setPhrasesOpen]       = useState(false);
  const [selectedCategory,  setSelectedCategory]  = useState<string | null>(null);

  const { data: phrasesData, isLoading: phrasesLoading } = useQuery({
    queryKey: ["assessment-phrases"],
    queryFn: async () => {
      const r = await fetch("/api/assessments/phrases");
      if (!r.ok) return { phrases: [] as Phrase[] };
      return (await r.json()) as { phrases: Phrase[] };
    },
    staleTime: Infinity,
  });

  const allPhrases    = phrasesData?.phrases ?? [];
  const categories    = [...new Set(allPhrases.map((p) => p.category))];
  const activePhrases = selectedCategory
    ? allPhrases.filter((p) => p.category === selectedCategory)
    : [];

  function setTech(key: TechniqueKey, value: boolean) {
    setTechnique((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeToDataUrl(file, 400, 500);
      setPhotoDataUrl(dataUrl);
    } catch {
      toast.error("שגיאה בטעינת התמונה");
    }
  }

  function removePhoto() {
    setPhotoDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function appendPhrase(text: string) {
    setNotes((prev) => (prev ? `${prev}\n${text}` : text));
  }

  const ratedCount = Object.keys(technique).length;
  const passCount  = Object.values(technique).filter(Boolean).length;

  async function handleSubmit() {
    if (!participantName.trim()) { toast.error("יש להזין שם משתתף"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_name:  participantName.trim(),
          participant_phone: participantPhone.trim(),
          event_date: eventDate,
          strong_hand: strongHand,
          strong_eye:  strongEye,
          technique,
          notes:     notes.trim(),
          photo_url: photoDataUrl,
        }),
      });
      if (!r.ok) throw new Error("failed");
      toast.success("הדוח נשמר");
      router.push(returnPath);
    } catch {
      toast.error("שגיאה בשמירת הדוח");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Right column (mobile: first) — info + attributes + notes ── */}
        <div className="flex flex-col gap-5">

          {/* Participant info + photo */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">פרטי משתתף</p>
            <div className="flex gap-4 items-start">

              {/* Photo */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative w-20 h-24 rounded-xl border-2 border-dashed transition-all duration-150 overflow-hidden flex flex-col items-center justify-center gap-1",
                    photoDataUrl ? "border-transparent" : "border-border/60 hover:border-primary/50 bg-muted/30 hover:bg-muted/50",
                  )}
                >
                  {photoDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photoDataUrl} alt="תמונת שחקן" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera size={20} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">תמונה</span>
                    </>
                  )}
                </button>
                {photoDataUrl && (
                  <button type="button" onClick={removePhoto} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                    הסר
                  </button>
                )}
              </div>

              {/* Text fields */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">שם מלא *</Label>
                    <Input value={participantName} onChange={(e) => setParticipantName(e.target.value)} placeholder="שם המשתתף" dir="rtl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">טלפון</Label>
                    <Input value={participantPhone} onChange={(e) => setParticipantPhone(e.target.value)} placeholder="05X-XXXXXXX" dir="ltr" />
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
              </div>
            </div>
          </section>

          {/* Player attributes */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-4 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">מאפייני השחקן</p>
            <div className="grid grid-cols-2 gap-4">
              <HandEyePicker label="יד חזקה" value={strongHand} onChange={setStrongHand} />
              <HandEyePicker label="עין חזקה" value={strongEye}  onChange={setStrongEye}  />
            </div>
          </section>

          {/* Notes + phrase suggestions */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">נקודות עיקריות לשיפור</p>
            <Textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="כתוב כאן את הנקודות העיקריות לשיפור..."
              className="resize-none text-sm leading-relaxed lg:min-h-[140px]"
              dir="rtl"
            />

            {/* Phrase suggestions */}
            <div className="border-t border-border/40 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  const next = !phrasesOpen;
                  setPhrasesOpen(next);
                  if (next && !selectedCategory && categories.length > 0) setSelectedCategory(categories[0]);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {phrasesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span>💡 משפטים מוכנים</span>
              </button>

              {phrasesOpen && (
                <div className="mt-3 flex flex-col gap-3">
                  {phrasesLoading ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-7 w-full rounded-full" />
                      <Skeleton className="h-20 w-full rounded-xl" />
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">לא נמצאו משפטים</p>
                  ) : (
                    <>
                      <div className="flex gap-1.5 flex-wrap" dir="rtl">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                              "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
                              selectedCategory === cat
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground",
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      {activePhrases.length > 0 && (
                        <div className="flex flex-col gap-1.5" dir="rtl">
                          {activePhrases.map((phrase, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => appendPhrase(phrase.text)}
                              className="text-right text-xs px-3 py-2 rounded-lg bg-muted/40 hover:bg-primary/8 hover:text-primary border border-transparent hover:border-primary/20 transition-all text-muted-foreground leading-relaxed"
                            >
                              {phrase.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Submit — visible on desktop inside left col */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => router.back()} disabled={saving}>ביטול</Button>
            <Button onClick={handleSubmit} disabled={saving || !participantName.trim()} className="min-w-28">
              {saving ? "שומר..." : "שמור דוח"}
            </Button>
          </div>
        </div>

        {/* ── Left column — technique ── */}
        <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm dark:ring-1 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">טכניקה</p>
            {ratedCount > 0 && (
              <span className="text-xs text-muted-foreground">{passCount}/{ratedCount} ✓</span>
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
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === true ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600",
                      )}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTech(c.key, false)}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === false ? "bg-red-500 border-red-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-red-400 hover:text-red-600",
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
      </div>

      {/* Submit — visible only on mobile (full width below grid) */}
      <div className="flex lg:hidden items-center justify-between gap-3 mt-5">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>ביטול</Button>
        <Button onClick={handleSubmit} disabled={saving || !participantName.trim()} className="min-w-28">
          {saving ? "שומר..." : "שמור דוח"}
        </Button>
      </div>
    </div>
  );
}

function resizeToDataUrl(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
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
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {side === "right" ? "ימין" : "שמאל"}
          </button>
        ))}
      </div>
    </div>
  );
}
