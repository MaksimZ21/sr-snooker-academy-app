"use client";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { Student, Group, Session } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

type Coach = { email: string; name: string; active: boolean };

const TRAINING_TYPES = [
  "private",
  "group",
  "beginners",
  "advanced",
  "technique",
  "match-play",
] as const;

export function AddSessionDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [driveUrl, setDriveUrl] = useState("");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const coachesQ = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open,
  });

  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    enabled: open,
  });

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: Group[] };
    },
    enabled: open,
    staleTime: 60_000,
  });

  const recentSessionsQ = useQuery({
    queryKey: ["sessions:recent-for-copy"],
    queryFn: async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const r = await fetch(`/api/sessions/week?start=${from}&end=${to}`);
      if (!r.ok) throw new Error("fetch failed");
      const data = (await r.json()) as { sessions: Session[] };
      return data.sessions
        .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time))
        .slice(0, 30);
    },
    enabled: open,
    staleTime: 60_000,
  });

  function applySession(sessionId: string | null) {
    const s = recentSessionsQ.data?.find((x) => x.id === sessionId);
    if (!s) return;
    setStartTime(s.start_time);
    setEndTime(s.end_time);
    setCoachEmail(s.coach_email);
    setTrainingType(s.training_type);
    setStudentIds(s.student_ids);
    setDriveUrl(s.drive_folder_url ?? "");
  }

  function addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function applyGroup(groupId: string | null) {
    const group = groupsQ.data?.groups.find((g) => g.id === groupId);
    if (!group) return;
    setStudentIds((prev) => [...new Set([...prev, ...group.student_ids])]);
    if (group.coach_email) setCoachEmail(group.coach_email);
    if (group.start_time) {
      setStartTime(group.start_time);
      setEndTime(addMinutes(group.start_time, 90));
    }
  }

  const reset = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setCoachEmail("");
    setTrainingType("");
    setStudentIds([]);
    setDriveUrl("");
    setSearch("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          start_time: startTime,
          end_time: endTime,
          coach_email: coachEmail,
          training_type: trainingType,
          student_ids: studentIds,
          drive_folder_url: driveUrl || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { id: string };
    },
    onSuccess: ({ id }) => {
      toast.success(`נוסף מפגש ${id}`);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
      qc.invalidateQueries({ queryKey: ["sessions:today"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת מפגש"),
  });

  const canSubmit =
    date &&
    startTime &&
    endTime &&
    coachEmail &&
    trainingType &&
    studentIds.length > 0 &&
    !mut.isPending;

  const toggleStudent = (id: string) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const activeCoaches = (coachesQ.data?.coaches ?? []).filter((c) => c.active);
  const activeStudents = (studentsQ.data?.students ?? []).filter((s) => s.active);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeStudents;
    return activeStudents.filter((s) => studentFullName(s).toLowerCase().includes(q));
  }, [activeStudents, search]);

  const isPrivate = trainingType === "private";
  const showGroupSelect = !isPrivate && (groupsQ.data?.groups ?? []).length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף מפגש
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הוסף מפגש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Copy from existing session */}
          <div>
            <Label className="text-muted-foreground text-xs">העתק מאימון קיים (אופציונלי)</Label>
            <Select onValueChange={applySession} disabled={recentSessionsQ.isLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={recentSessionsQ.isLoading ? "טוען..." : "בחר אימון להעתקה..."} />
              </SelectTrigger>
              <SelectContent>
                {(recentSessionsQ.data ?? []).map((s) => {
                  const dateStr = `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`;
                  const label = s.name || TRAINING_TYPE_LABEL[s.training_type] || s.training_type;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {dateStr} · {s.start_time} · {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border/40" />

          <div>
            <Label>תאריך</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>שעת התחלה</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>שעת סיום</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>מאמן</Label>
            <Select value={coachEmail} onValueChange={(v) => setCoachEmail(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="בחר מאמן" />
              </SelectTrigger>
              <SelectContent>
                {activeCoaches.map((c) => (
                  <SelectItem key={c.email} value={c.email}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>סוג אימון</Label>
            <Select value={trainingType} onValueChange={(v) => setTrainingType(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="בחר סוג אימון" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRAINING_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>מתאמנים</Label>
              {studentIds.length > 0 && (
                <span className="text-xs font-medium text-primary">
                  {studentIds.length} נבחרו
                </span>
              )}
            </div>

            {showGroupSelect && (
              <Select onValueChange={applyGroup}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="הוסף קבוצה שלמה..." />
                </SelectTrigger>
                <SelectContent>
                  {(groupsQ.data?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.student_ids.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="border border-border/60 rounded-xl overflow-hidden">
              <div className="px-2 pt-2 pb-1.5 border-b border-border/60 bg-muted/30">
                <Input
                  placeholder="חפש מתאמן..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-sm bg-background"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {studentsQ.isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">טוען...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {search ? "לא נמצאו מתאמנים" : "אין מתאמנים פעילים"}
                  </div>
                ) : (
                  filteredStudents.map((s) => {
                    const selected = studentIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStudent(s.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-right transition-colors hover:bg-muted/50 border-b border-border/30 last:border-0",
                          selected && "bg-primary/8",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            selected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={cn("flex-1", selected && "font-semibold text-primary")}>
                          {studentFullName(s)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>קישור לתיקיית סילבוס ב-Drive</Label>
            <Input
              type="url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mut.isPending}
          >
            ביטול
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
