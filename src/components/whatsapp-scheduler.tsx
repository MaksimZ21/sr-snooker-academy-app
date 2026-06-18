"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";

type WhatsAppGroup = { id: string; name: string };
type Coach = { email: string; name: string; phone: string };
type RecipientMode = "group" | "coaches";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "ממתין", variant: "outline" },
  sent: { label: "נשלח", variant: "default" },
  failed: { label: "נכשל", variant: "destructive" },
};

function formatLocalDatetime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WhatsAppScheduler() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RecipientMode>("group");
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  function resetDialog() {
    setMode("group");
    setChatId("");
    setChatName("");
    setMessage("");
    setScheduledAt("");
  }

  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ["whatsapp:scheduled"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/scheduled");
      return (await r.json()) as { messages: ScheduledMessage[] };
    },
  });

  const { data: groupData, isLoading: loadingGroups } = useQuery({
    queryKey: ["whatsapp:groups"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/groups");
      return (await r.json()) as { groups: WhatsAppGroup[] };
    },
    enabled: open && mode === "group",
    staleTime: 5 * 60_000,
  });

  const { data: coachData, isLoading: loadingCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open && mode === "coaches",
    staleTime: 5 * 60_000,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/whatsapp/scheduled", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          chat_name: chatName,
          message,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("ההודעה תוזמנה");
      qc.invalidateQueries({ queryKey: ["whatsapp:scheduled"] });
      setOpen(false);
      resetDialog();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/scheduled/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("ההודעה נמחקה");
      qc.invalidateQueries({ queryKey: ["whatsapp:scheduled"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  function handleModeChange(next: RecipientMode) {
    setMode(next);
    setChatId("");
    setChatName("");
  }

  function handleRecipientChange(val: string | null) {
    if (!val) return;
    setChatId(val);
    if (mode === "group") {
      setChatName(groupData?.groups.find((g) => g.id === val)?.name ?? "");
    } else {
      if (val === "coaches:all") {
        setChatName("כל המאמנים");
      } else {
        const c = coachData?.coaches.find((c) => `coach:${c.email}` === val);
        setChatName(c?.name ?? "");
      }
    }
  }

  const canSubmit = chatId && message.trim() && scheduledAt && !addMut.isPending;
  const messages = msgData?.messages ?? [];
  const pending = messages.filter((m) => m.status === "pending");
  const history = messages.filter((m) => m.status !== "pending");
  const isLoadingRecipients = mode === "group" ? loadingGroups : loadingCoaches;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">הודעות מתוזמנות לקבוצות ומאמנים</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} className="ml-1.5" />
          הודעה חדשה
        </Button>
      </div>

      {/* Pending */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ממתינות לשליחה</p>
        {loadingMsgs ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין הודעות מתוזמנות</p>
        ) : (
          pending.map((m) => (
            <MessageCard key={m.id} m={m} onDelete={() => deleteMut.mutate(m.id)} />
          ))
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">היסטוריה</p>
          {history.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetDialog(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הודעה חדשה</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {/* Mode toggle */}
            <div>
              <Label>סוג נמען</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={mode === "group" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => handleModeChange("group")}
                  type="button"
                >
                  קבוצת WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant={mode === "coaches" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => handleModeChange("coaches")}
                  type="button"
                >
                  מאמנים
                </Button>
              </div>
            </div>

            {/* Recipient picker */}
            <div>
              <Label>{mode === "group" ? "קבוצה" : "מאמן"}</Label>
              {isLoadingRecipients ? (
                <Skeleton className="h-9 w-full rounded-md mt-1" />
              ) : (
                <Select value={chatId} onValueChange={(val: string | null) => handleRecipientChange(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={mode === "group" ? "בחר קבוצה..." : "בחר מאמן..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {mode === "group"
                      ? (groupData?.groups ?? []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))
                      : <>
                          <SelectItem value="coaches:all">כל המאמנים</SelectItem>
                          {(coachData?.coaches ?? [])
                            .filter((c) => c.phone)
                            .map((c) => (
                              <SelectItem key={c.email} value={`coach:${c.email}`}>{c.name}</SelectItem>
                            ))}
                        </>
                    }
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>הודעה</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="כתוב את ההודעה..."
              />
            </div>
            <div>
              <Label>תאריך ושעת שליחה</Label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetDialog(); }} disabled={addMut.isPending}>
              ביטול
            </Button>
            <Button disabled={!canSubmit} onClick={() => addMut.mutate()}>
              {addMut.isPending ? "שומר..." : "תזמן"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageCard({ m, onDelete }: { m: ScheduledMessage; onDelete?: () => void }) {
  const { label, variant } = STATUS_BADGE[m.status] ?? STATUS_BADGE.pending;
  const StatusIcon = m.status === "sent" ? CheckCircle2 : m.status === "failed" ? XCircle : Clock;

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <StatusIcon size={16} className={
          m.status === "sent" ? "text-emerald-500 mt-0.5 shrink-0" :
          m.status === "failed" ? "text-destructive mt-0.5 shrink-0" :
          "text-muted-foreground mt-0.5 shrink-0"
        } />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm">{m.chat_name || m.chat_id}</span>
            <Badge variant={variant} className="text-xs">{label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{m.message}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock size={10} />
            {formatLocalDatetime(m.scheduled_at)}
          </p>
        </div>
        {m.status === "pending" && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
