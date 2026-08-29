"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import type { Session } from "@/lib/sheets/schemas";

type Coach = { email: string; name: string; active: boolean };

const TRAINING_TYPES = ["private", "group", "beginners", "advanced", "technique", "match-play"] as const;
const MINUTES = ["00", "15", "30", "45"];
const HOURS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0"));

function splitTime(t: string): [string, string] {
  const parts = (t ?? "").split(":");
  return parts.length === 2 ? [parts[0], parts[1]] : ["", "00"];
}

export function EditSessionDialog({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(session.date);
  const [startH, setStartH] = useState(() => splitTime(session.start_time)[0]);
  const [startM, setStartM] = useState(() => splitTime(session.start_time)[1]);
  const [endH, setEndH] = useState(() => splitTime(session.end_time)[0]);
  const [endM, setEndM] = useState(() => splitTime(session.end_time)[1]);
  const [coachEmail, setCoachEmail] = useState(session.coach_email);
  const [trainingType, setTrainingType] = useState<string>(session.training_type);
  const [status, setStatus] = useState(session.status);
  const [price, setPrice] = useState(session.price_nis != null ? String(session.price_nis) : "");
  const qc = useQueryClient();

  const coachesQ = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open,
    staleTime: 60_000,
  });

  function onOpenChange(v: boolean) {
    if (v) {
      setDate(session.date);
      const [sh, sm] = splitTime(session.start_time);
      const [eh, em] = splitTime(session.end_time);
      setStartH(sh); setStartM(sm);
      setEndH(eh); setEndM(em);
      setCoachEmail(session.coach_email);
      setTrainingType(session.training_type);
      setStatus(session.status);
      setPrice(session.price_nis != null ? String(session.price_nis) : "");
    }
    setOpen(v);
  }

  const activeCoaches = (coachesQ.data?.coaches ?? []).filter((c) => c.active);
  const startTime = startH ? `${startH}:${startM}` : "";
  const endTime = endH ? `${endH}:${endM}` : "";

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date, start_time: startTime, end_time: endTime, coach_email: coachEmail, training_type: trainingType, status,
          ...(price.trim() !== "" && { price_nis: Number(price) }),
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המפגש עודכן");
      qc.invalidateQueries({ queryKey: ["session", session.id] });
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
      setOpen(false);
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/15" />}>
        <Pencil size={15} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת מפגש</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>שעת התחלה</Label>
              <div className="flex gap-1.5">
                <Select value={startH} onValueChange={(v) => setStartH(v ?? "")}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="שע׳" /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={startM} onValueChange={(v) => setStartM(v ?? "00")} disabled={!startH}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="דק׳" /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>שעת סיום</Label>
              <div className="flex gap-1.5">
                <Select value={endH} onValueChange={(v) => setEndH(v ?? "")}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="שע׳" /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={endM} onValueChange={(v) => setEndM(v ?? "00")} disabled={!endH}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="דק׳" /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div>
            <Label>מאמן</Label>
            <Select value={coachEmail || "__none__"} onValueChange={(v) => setCoachEmail(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>
                  {coachEmail ? (activeCoaches.find((c) => c.email === coachEmail)?.name ?? coachEmail) : "ללא מאמן"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא מאמן</SelectItem>
                {activeCoaches.map((c) => <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>סוג אימון</Label>
            <Select value={trainingType} onValueChange={(v) => setTrainingType(v ?? "")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{TRAINING_TYPE_LABEL[t as keyof typeof TRAINING_TYPE_LABEL]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "scheduled")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">פעיל</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>מחיר (₪)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="אוטומטי אם ריק"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mut.isPending}>ביטול</Button>
          <Button onClick={() => mut.mutate()} disabled={!date || !startTime || mut.isPending}>
            {mut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
