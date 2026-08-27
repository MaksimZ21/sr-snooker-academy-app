"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Play } from "lucide-react";
import type { Automation } from "@/app/api/whatsapp/automations/route";

type WhatsAppGroup = { id: string; name: string };

export function RunAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<Record<string, string>>(
    () => Object.fromEntries(automation.steps.map((s) => [s.id, s.time_of_day ?? ""])),
  );

  const { data: groupData, isLoading: loadingGroups } = useQuery({
    queryKey: ["whatsapp:groups"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: WhatsAppGroup[] };
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const chatName = groupData?.groups.find((g) => g.id === chatId)?.name ?? "";
  const canRun = Boolean(chatId) && Boolean(date) && automation.steps.every((s) => (times[s.id] ?? "").trim());

  const runMut = useMutation({
    mutationFn: async () => {
      for (const step of automation.steps) {
        const scheduledAt = new Date(`${date}T${times[step.id]}`).toISOString();
        const r = await fetch("/api/whatsapp/scheduled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            chat_name: chatName,
            message: step.payload,
            scheduled_at: scheduledAt,
          }),
        });
        if (!r.ok) throw new Error("failed");
      }
    },
    onSuccess: () => {
      toast.success("האוטומציה תוזמנה");
      setOpen(false);
    },
    onError: () => toast.error("שגיאה בתזמון"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Play className="ml-2 h-4 w-4" />
        הפעל
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הפעלת &quot;{automation.name}&quot;</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">קבוצת WhatsApp</Label>
            {loadingGroups ? (
              <p className="text-sm text-muted-foreground">טוען...</p>
            ) : (
              <Select value={chatId} onValueChange={(v) => setChatId(v ?? "")} disabled={runMut.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קבוצה..." />
                </SelectTrigger>
                <SelectContent>
                  {(groupData?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">תאריך</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={runMut.isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            {automation.steps.map((step, i) => (
              <div key={step.id}>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  שעת שלב {i + 1} ({step.message_type === "text" ? "טקסט" : "הגדרות קבוצה"})
                </Label>
                <input
                  type="time"
                  value={times[step.id] ?? ""}
                  onChange={(e) => setTimes((prev) => ({ ...prev, [step.id]: e.target.value }))}
                  disabled={runMut.isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={runMut.isPending}>
            ביטול
          </Button>
          <Button onClick={() => runMut.mutate()} disabled={!canRun || runMut.isPending}>
            {runMut.isPending ? "מתזמן..." : "תזמן הכל"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
