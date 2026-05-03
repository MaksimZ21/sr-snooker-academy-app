"use client";
import { useState } from "react";
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
import { Plus } from "lucide-react";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import type { Student, Group } from "@/lib/sheets/schemas";

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

  function applyGroup(groupId: string) {
    const group = groupsQ.data?.groups.find((g) => g.id === groupId);
    if (!group) return;
    setStudentIds((prev) => [
      ...new Set([...prev, ...group.student_ids]),
    ]);
  }

  const reset = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setCoachEmail("");
    setTrainingType("");
    setStudentIds([]);
    setDriveUrl("");
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
  const activeStudents = (studentsQ.data?.students ?? []).filter(
    (s) => s.active,
  );

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
            <Select
              value={coachEmail}
              onValueChange={(v) => setCoachEmail(v ?? "")}
            >
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
            <Select
              value={trainingType}
              onValueChange={(v) => setTrainingType(v ?? "")}
            >
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
          <div>
            <Label>מתאמנים</Label>
            {(groupsQ.data?.groups ?? []).length > 0 && (
              <Select onValueChange={applyGroup}>
                <SelectTrigger className="w-full mb-2">
                  <SelectValue placeholder="הוסף קבוצה..." />
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
            <div className="border rounded-md max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
              {activeStudents.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  אין מתאמנים פעילים
                </span>
              )}
              {activeStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 cursor-pointer text-sm py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={studentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                  />
                  <span>
                    {s.name}{" "}
                    <span className="text-muted-foreground">({s.id})</span>
                  </span>
                </label>
              ))}
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
