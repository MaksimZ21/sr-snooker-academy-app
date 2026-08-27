"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Automation, AutomationStep } from "@/app/api/whatsapp/automations/route";

type StepDraft = {
  key: string;
  time_of_day: string;
  message_type: "text" | "group_settings";
  text: string;
  groupOpen: boolean | null;
};

function newStep(): StepDraft {
  return { key: crypto.randomUUID(), time_of_day: "", message_type: "text", text: "", groupOpen: null };
}

function stepFromApi(s: AutomationStep): StepDraft {
  if (s.message_type === "group_settings") {
    let groupOpen: boolean | null = null;
    try {
      const parsed = JSON.parse(s.payload) as { allowParticipantsSendMessages?: boolean };
      groupOpen = typeof parsed.allowParticipantsSendMessages === "boolean" ? parsed.allowParticipantsSendMessages : null;
    } catch {}
    return { key: s.id, time_of_day: s.time_of_day ?? "", message_type: "group_settings", text: "", groupOpen };
  }
  return { key: s.id, time_of_day: s.time_of_day ?? "", message_type: "text", text: s.payload, groupOpen: null };
}

function stepIsValid(s: StepDraft): boolean {
  if (s.message_type === "text") return s.text.trim().length > 0;
  return s.groupOpen !== null;
}

function stepToPayload(s: StepDraft) {
  return {
    time_of_day: s.time_of_day || null,
    message_type: s.message_type,
    payload:
      s.message_type === "text"
        ? s.text
        : JSON.stringify({ __type: "group_settings", allowParticipantsSendMessages: s.groupOpen }),
  };
}

function AutomationForm({
  automation,
  onDone,
}: {
  automation?: Automation;
  onDone: () => void;
}) {
  const [name, setName] = useState(automation?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    () => (automation ? automation.steps.map(stepFromApi) : [newStep()]),
  );
  const qc = useQueryClient();

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s.key !== key));
  }

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every(stepIsValid);

  const mut = useMutation({
    mutationFn: async () => {
      const body = { name, steps: steps.map(stepToPayload) };
      const r = automation
        ? await fetch(`/api/whatsapp/automations/${automation.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/whatsapp/automations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(automation ? "אוטומציה עודכנה" : "אוטומציה נוצרה");
      qc.invalidateQueries({ queryKey: ["whatsapp:automations"] });
      onDone();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">שם האוטומציה</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="פתיחה וסגירה יומית" dir="auto" />
      </div>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-col gap-2 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">שלב {i + 1}</span>
              {steps.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(step.key)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">שעה (אופציונלי)</Label>
              <input
                type="time"
                value={step.time_of_day}
                onChange={(e) => updateStep(step.key, { time_of_day: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={step.message_type === "text" ? "default" : "outline"}
                className="flex-1"
                onClick={() => updateStep(step.key, { message_type: "text" })}
              >
                טקסט
              </Button>
              <Button
                size="sm"
                variant={step.message_type === "group_settings" ? "default" : "outline"}
                className="flex-1"
                onClick={() => updateStep(step.key, { message_type: "group_settings" })}
              >
                הגדרות קבוצה
              </Button>
            </div>
            {step.message_type === "text" ? (
              <Textarea
                rows={3}
                value={step.text}
                onChange={(e) => updateStep(step.key, { text: e.target.value })}
                placeholder="כתוב את ההודעה..."
                className="resize-y text-sm"
                dir="auto"
              />
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={step.groupOpen === true ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateStep(step.key, { groupOpen: true })}
                >
                  פתח קבוצה
                </Button>
                <Button
                  size="sm"
                  variant={step.groupOpen === false ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateStep(step.key, { groupOpen: false })}
                >
                  סגור קבוצה
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setSteps((prev) => [...prev, newStep()])}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף שלב
      </Button>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mut.isPending}>
          ביטול
        </Button>
        <Button onClick={() => mut.mutate()} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "שומר..." : "שמור"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreateAutomationDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="ml-2 h-4 w-4" />
        אוטומציה חדשה
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>אוטומציה חדשה</DialogTitle>
        </DialogHeader>
        <AutomationForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת אוטומציה</DialogTitle>
        </DialogHeader>
        <AutomationForm automation={automation} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
