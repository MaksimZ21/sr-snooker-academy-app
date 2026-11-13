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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { College } from "@/lib/sheets/colleges";
import { useSkillLevels } from "@/components/use-skill-levels";

export function AddStudentDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [collegeName, setCollegeName] = useState("__none__");
  const [subscriptionType, setSubscriptionType] = useState("");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [lastPaymentDate, setLastPaymentDate] = useState("");
  const [skillLevel, setSkillLevel] = useState("__none__");
  const [skillLevel9, setSkillLevel9] = useState("__none__");
  const qc = useQueryClient();
  const { lists: levelLists } = useSkillLevels();

  const collegesQ = useQuery({
    queryKey: ["colleges"],
    queryFn: async () => {
      const r = await fetch("/api/colleges");
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { colleges: College[] };
    },
    staleTime: 60_000,
  });

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setCollegeName("__none__");
    setSubscriptionType("");
    setNotes("");
    setBirthDate("");
    setLastPaymentDate("");
    setSkillLevel("__none__");
    setSkillLevel9("__none__");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType,
          general_notes: notes,
          birth_date: birthDate || null,
          last_payment_date: lastPaymentDate || null,
          skill_level: skillLevel === "__none__" ? null : skillLevel,
          skill_level_9ft: skillLevel9 === "__none__" ? null : skillLevel9,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בהוספת מתאמן");
      }
      return (await r.json()) as { id: string };
    },
    onSuccess: ({ id }) => {
      toast.success(`נוסף מתאמן ${id}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהוספת מתאמן"),
  });

  const canSubmit = (firstName.trim().length > 0 || lastName.trim().length > 0) && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף מתאמן
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף מתאמן</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>שם פרטי</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label>שם משפחה</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <Label>טלפון</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>מייל</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>מכללה</Label>
            <Select value={collegeName} onValueChange={(v) => setCollegeName(v ?? "__none__")}>
              <SelectTrigger>
                <SelectValue placeholder="בחר מכללה..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא מכללה</SelectItem>
                {(collegesQ.data?.colleges ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>סוג מנוי</Label>
            <Input value={subscriptionType} onChange={(e) => setSubscriptionType(e.target.value)} />
          </div>
          <div>
            <Label>תאריך לידה</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>תאריך תשלום אחרון</Label>
            <Input type="date" value={lastPaymentDate} onChange={(e) => setLastPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>סיווג 9-10 פיט</Label>
            <Select value={skillLevel9} onValueChange={(v) => setSkillLevel9(v ?? "__none__")}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סיווג..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא סיווג</SelectItem>
                {levelLists["9-10"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>סיווג 12 פיט</Label>
            <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v ?? "__none__")}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סיווג..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא סיווג</SelectItem>
                {levelLists["12"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>הערות כלליות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
