"use client";
import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import type { Group, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

type Coach = { email: string; name: string; active: boolean };

function GroupForm({
  group,
  onClose,
}: {
  group?: Group;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [collegeName, setCollegeName] = useState(group?.college_name ?? "");
  const [coachEmail, setCoachEmail] = useState(group?.coach_email ?? "");
  const [startHour, setStartHour] = useState(() => group?.start_time?.split(":")[0] ?? "");
  const [startMin, setStartMin] = useState(() => group?.start_time?.split(":")[1] ?? "00");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group?.student_ids ?? []),
  );
  const startTime = startHour ? `${startHour}:${startMin}` : "";
  const qc = useQueryClient();

  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    staleTime: 60_000,
  });

  const coachesQ = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    staleTime: 60_000,
  });

  const colleges = useMemo(() => {
    const names = (studentsQ.data?.students ?? []).map((s) => s.college_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [studentsQ.data]);

  const activeCoaches = (coachesQ.data?.coaches ?? []).filter((c) => c.active);

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        student_ids: Array.from(selected),
        college_name: collegeName,
        coach_email: coachEmail,
        start_time: startTime,
      };
      const r = group
        ? await fetch(`/api/groups/${group.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/groups", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(group ? "קבוצה עודכנה" : "קבוצה נוצרה");
      qc.invalidateQueries({ queryKey: ["groups"] });
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const activeStudents = (studentsQ.data?.students ?? []).filter((s) => s.active);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>שם הקבוצה</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="קבוצת שני, מתקדמים..."
        />
      </div>
      <div>
        <Label>שיוך למכללה (אופציונלי)</Label>
        <Select
          value={collegeName || "__none__"}
          onValueChange={(v) => setCollegeName(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ללא שיוך למכללה</SelectItem>
            {colleges.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>מאמן</Label>
        <Select
          value={coachEmail || "__none__"}
          onValueChange={(v) => setCoachEmail(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue>
              {coachEmail
                ? (activeCoaches.find((c) => c.email === coachEmail)?.name ?? coachEmail)
                : "ללא מאמן"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ללא מאמן</SelectItem>
            {activeCoaches.map((c) => (
              <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>שעת התחלה קבועה</Label>
        <div className="flex gap-2">
          <Select value={startHour} onValueChange={(v) => setStartHour(v ?? "")}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="שעה" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => {
                const val = String(h).padStart(2, "0");
                return <SelectItem key={val} value={val}>{val}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={startMin} onValueChange={(v) => setStartMin(v ?? "00")} disabled={!startHour}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="דקות" />
            </SelectTrigger>
            <SelectContent>
              {["00", "15", "30", "45"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>מתאמנים</Label>
        {studentsQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-2">טוען...</div>
        ) : (
          <div className="border rounded-md max-h-56 overflow-y-auto p-2 flex flex-col gap-1 mt-1">
            {activeStudents.length === 0 && (
              <span className="text-sm text-muted-foreground">אין מתאמנים פעילים</span>
            )}
            {activeStudents.map((s) => (
              <Label
                key={s.id}
                className="flex items-center gap-2 cursor-pointer text-sm font-normal"
              >
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(s.id);
                    else next.delete(s.id);
                    setSelected(next);
                  }}
                />
                <span>{studentFullName(s)}</span>
                <span className="text-xs text-muted-foreground">{s.id}</span>
              </Label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{selected.size} נבחרו</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={mut.isPending}>
          ביטול
        </Button>
        <Button
          onClick={() => mut.mutate()}
          disabled={!name.trim() || selected.size === 0 || mut.isPending}
        >
          {mut.isPending ? "שומר..." : "שמור"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        קבוצה חדשה
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>קבוצה חדשה</DialogTitle>
        </DialogHeader>
        <GroupForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditGroupDialog({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת קבוצה</DialogTitle>
        </DialogHeader>
        <GroupForm group={group} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
