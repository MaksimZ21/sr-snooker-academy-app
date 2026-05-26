"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Student } from "@/lib/sheets/schemas";

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [phone, setPhone] = useState(student.phone);
  const [email, setEmail] = useState(student.email);
  const [collegeName, setCollegeName] = useState(student.college_name);
  const [subscriptionType, setSubscriptionType] = useState(student.subscription_type);
  const [notes, setNotes] = useState(student.general_notes);
  const [active, setActive] = useState(student.active);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setPhone(student.phone);
      setEmail(student.email);
      setCollegeName(student.college_name);
      setSubscriptionType(student.subscription_type);
      setNotes(student.general_notes);
      setActive(student.active);
    }
  }, [open, student]);

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          college_name: collegeName.trim(),
          subscription_type: subscriptionType.trim(),
          general_notes: notes.trim(),
          active,
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הפרטים עודכנו");
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: () => toast.error("שגיאה בעדכון הפרטים"),
  });

  const canSubmit = (firstName.trim().length > 0 || lastName.trim().length > 0) && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת מתאמן — {student.id}</DialogTitle>
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
            <Label>שם מכללה</Label>
            <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} />
          </div>
          <div>
            <Label>סוג מנוי</Label>
            <Input value={subscriptionType} onChange={(e) => setSubscriptionType(e.target.value)} />
          </div>
          <div>
            <Label>הערות כלליות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none min-h-[80px]"
            />
          </div>
          <div>
            <Label>סטטוס</Label>
            <Select
              value={active ? "active" : "inactive"}
              onValueChange={(v) => setActive(v === "active")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
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
