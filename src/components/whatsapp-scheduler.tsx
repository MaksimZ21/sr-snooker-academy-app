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
import { Plus, Trash2, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";

type WhatsAppGroup = { id: string; name: string };

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
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

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
    enabled: open,
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
      setMessage("");
      setChatId("");
      setChatName("");
      setScheduledAt("");
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

  const canSubmit = chatId && message.trim() && scheduledAt && !addMut.isPending;

  const messages = msgData?.messages ?? [];
  const pending = messages.filter((m) => m.status === "pending");
  const history = messages.filter((m) => m.status !== "pending");

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">הודעות מתוזמנות לקבוצות WhatsApp</p>
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
      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הודעה חדשה לקבוצת WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>קבוצה</Label>
              {loadingGroups ? (
                <Skeleton className="h-9 w-full rounded-md mt-1" />
              ) : (
                <Select
                  value={chatId}
                  onValueChange={(val: string | null) => {
                    if (!val) return;
                    setChatId(val);
                    const g = groupData?.groups.find((g) => g.id === val);
                    setChatName(g?.name ?? "");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="בחר קבוצה..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(groupData?.groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
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
            <Button variant="outline" onClick={() => setOpen(false)} disabled={addMut.isPending}>
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
