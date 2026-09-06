"use client";

import { useRef, useState } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Image,
  ListChecks,
  Loader2,
  Lock,
  MessageSquare,
  BarChart2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";
import { WhatsAppTemplatesDialog } from "@/components/whatsapp-template-dialog";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";
import { WhatsAppAutomationsPanel } from "@/components/whatsapp-automations-panel";

type WhatsAppGroup = { id: string; name: string };
type Coach = { email: string; name: string; phone: string };
type RecipientMode = "group" | "coaches";
type MessageType = "text" | "image" | "poll" | "group_settings";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "ממתין", variant: "outline" },
  sent: { label: "נשלח", variant: "default" },
  failed: { label: "נכשל", variant: "destructive" },
};

const HISTORY_PAGE_SIZE = 20;

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

type ParsedMsg =
  | { type: "text"; preview: string }
  | { type: "image"; preview: string }
  | { type: "poll"; preview: string }
  | { type: "group_settings"; preview: string };

function parseDisplay(raw: string): ParsedMsg {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image") return { type: "image", preview: typeof p.caption === "string" && p.caption ? p.caption : "(תמונה)" };
    if (p.__type === "poll") return { type: "poll", preview: typeof p.question === "string" ? p.question : "(סקר)" };
    if (p.__type === "group_settings") {
      return {
        type: "group_settings",
        preview: p.allowParticipantsSendMessages === true ? "פתיחת קבוצה" : "סגירת קבוצה",
      };
    }
  } catch {}
  return { type: "text", preview: raw };
}

type ListItem =
  | { kind: "single"; message: ScheduledMessage }
  | { kind: "batch"; runId: string; automationName: string; chatName: string; messages: ScheduledMessage[] };

function groupByAutomationRun(messages: ScheduledMessage[]): ListItem[] {
  const seen = new Set<string>();
  const items: ListItem[] = [];
  for (const m of messages) {
    if (m.automation_run_id) {
      if (seen.has(m.automation_run_id)) continue;
      seen.add(m.automation_run_id);
      const batch = messages.filter((x) => x.automation_run_id === m.automation_run_id);
      items.push({
        kind: "batch",
        runId: m.automation_run_id,
        automationName: m.automation_name ?? "אוטומציה",
        chatName: m.chat_name,
        messages: batch,
      });
    } else {
      items.push({ kind: "single", message: m });
    }
  }
  return items;
}

export function WhatsAppScheduler() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("scheduled");

  // Compose state
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("group");
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [msgType, setMsgType] = useState<MessageType>("text");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageFileName, setImageFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  // Bumped on every successful reset and used as `key` on each
  // WhatsAppTemplatePicker below, so a leftover template selection can't
  // linger visually after submit. Currently redundant in practice — the
  // compose tab panel unmounts on its own (Base UI Tabs default
  // keepMounted={false}) since resetCompose() always pairs with switching
  // back to the "scheduled" tab — but kept as a deliberate safety net in
  // case that reset flow ever stops always leaving the compose tab.
  const [composeKey, setComposeKey] = useState(0);

  function resetCompose() {
    setChatId("");
    setChatName("");
    setMsgType("text");
    setText("");
    setImageUrl("");
    setImageCaption("");
    setImageFileName("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setGroupOpen(null);
    setScheduledAt("");
    setComposeKey((k) => k + 1);
  }

  const scheduledQuery = useInfiniteQuery({
    queryKey: ["whatsapp:scheduled"],
    queryFn: async ({ pageParam }) => {
      const r = await fetch(`/api/whatsapp/scheduled?historyOffset=${pageParam}&historyLimit=${HISTORY_PAGE_SIZE}`);
      return (await r.json()) as { pending: ScheduledMessage[]; history: ScheduledMessage[]; historyHasMore: boolean };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.historyHasMore ? allPages.length * HISTORY_PAGE_SIZE : undefined),
  });
  const loadingMsgs = scheduledQuery.isLoading;

  const { data: groupData, isLoading: loadingGroups, isError: groupsError } = useQuery({
    queryKey: ["whatsapp:groups"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/groups");
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      return (await r.json()) as { groups: WhatsAppGroup[] };
    },
    enabled: recipientMode === "group",
    staleTime: 5 * 60_000,
  });

  const { data: coachData, isLoading: loadingCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: recipientMode === "coaches",
    staleTime: 5 * 60_000,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      let message: string;
      if (msgType === "text") {
        message = text;
      } else if (msgType === "image") {
        message = JSON.stringify({ __type: "image", url: imageUrl, caption: imageCaption });
      } else if (msgType === "poll") {
        message = JSON.stringify({
          __type: "poll",
          question: pollQuestion,
          options: pollOptions.filter((o) => o.trim()),
        });
      } else {
        message = JSON.stringify({
          __type: "group_settings",
          allowParticipantsSendMessages: groupOpen,
        });
      }
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
      resetCompose();
      setActiveTab("scheduled");
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

  const deleteBatchMut = useMutation({
    mutationFn: async (runId: string) => {
      const r = await fetch(`/api/whatsapp/scheduled/batch/${runId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("האוטומציה בוטלה");
      qc.invalidateQueries({ queryKey: ["whatsapp:scheduled"] });
    },
    onError: () => toast.error("שגיאה בביטול"),
  });

  async function handleFileUpload(file: File) {
    setImageUploading(true);
    setImageFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/upload/image", { method: "POST", body: form });
      const json = await r.json() as { url?: string; error?: string };
      if (!r.ok || !json.url) throw new Error(json.error ?? "upload failed");
      setImageUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בהעלאת הקובץ");
      setImageFileName("");
    } finally {
      setImageUploading(false);
    }
  }

  function handleRecipientModeChange(next: RecipientMode) {
    setRecipientMode(next);
    setChatId("");
    setChatName("");
  }

  function handleMsgTypeChange(next: MessageType) {
    setMsgType(next);
    if (next === "group_settings" && recipientMode !== "group") {
      handleRecipientModeChange("group");
    }
  }

  // Pre-fills the compose form from a past (sent/failed) message so it can
  // be scheduled again, and switches to the compose tab. The date/time is
  // deliberately left empty — the admin always picks a fresh one.
  function handleReschedule(m: ScheduledMessage) {
    setRecipientMode(m.chat_id.startsWith("coach:") || m.chat_id === "coaches:all" ? "coaches" : "group");
    setChatId(m.chat_id);
    setChatName(m.chat_name);

    try {
      const p = JSON.parse(m.message) as Record<string, unknown>;
      if (p.__type === "image") {
        setMsgType("image");
        setImageUrl(typeof p.url === "string" ? p.url : "");
        setImageCaption(typeof p.caption === "string" ? p.caption : "");
        setImageFileName("");
      } else if (p.__type === "poll") {
        setMsgType("poll");
        setPollQuestion(typeof p.question === "string" ? p.question : "");
        const opts = Array.isArray(p.options) ? (p.options as string[]) : [];
        setPollOptions(opts.length >= 2 ? opts : ["", ""]);
      } else if (p.__type === "group_settings") {
        setMsgType("group_settings");
        setGroupOpen(p.allowParticipantsSendMessages === true);
      } else {
        throw new Error("unrecognized message shape");
      }
    } catch {
      setMsgType("text");
      setText(m.message);
    }

    setScheduledAt("");
    setComposeKey((k) => k + 1);
    setActiveTab("compose");
  }

  function handleRecipientChange(val: string) {
    setChatId(val);
    if (recipientMode === "group") {
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

  const isLoadingRecipients = recipientMode === "group" ? loadingGroups : loadingCoaches;
  const validOptions = pollOptions.filter((o) => o.trim());
  const canSubmit =
    chatId &&
    scheduledAt &&
    !addMut.isPending &&
    !imageUploading &&
    ((msgType === "text" && text.trim()) ||
      (msgType === "image" && imageUrl.trim()) ||
      (msgType === "poll" && pollQuestion.trim() && validOptions.length >= 2) ||
      (msgType === "group_settings" && groupOpen !== null));

  const pending = scheduledQuery.data?.pages[0]?.pending ?? [];
  const history = scheduledQuery.data?.pages.flatMap((p) => p.history) ?? [];

  return (
    <div className="p-4 md:p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-3 mb-5">
          <TabsList>
            <TabsTrigger value="scheduled">
              הודעות מתוזמנות
              {pending.length > 0 && (
                <span className="mr-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="compose">הודעה חדשה</TabsTrigger>
            <TabsTrigger value="automations">אוטומציות</TabsTrigger>
          </TabsList>
          <WhatsAppTemplatesDialog />
        </div>

        {/* ── Scheduled list ── */}
        <TabsContent value="scheduled">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ממתינות לשליחה</p>
              {loadingMsgs ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : pending.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  אין הודעות מתוזמנות
                </div>
              ) : (
                groupByAutomationRun(pending).map((item) =>
                  item.kind === "batch" ? (
                    <AutomationBatchCard
                      key={item.runId}
                      batch={item}
                      onDeleteBatch={(runId) => deleteBatchMut.mutate(runId)}
                    />
                  ) : (
                    <MessageCard key={item.message.id} m={item.message} onDelete={() => deleteMut.mutate(item.message.id)} />
                  ),
                )
              )}
            </div>

            {history.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">היסטוריה</p>
                {groupByAutomationRun(history).map((item) =>
                  item.kind === "batch" ? (
                    <AutomationBatchCard key={item.runId} batch={item} onRescheduleMessage={handleReschedule} />
                  ) : (
                    <MessageCard key={item.message.id} m={item.message} onReschedule={() => handleReschedule(item.message)} />
                  ),
                )}
                {scheduledQuery.hasNextPage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-center mt-1"
                    onClick={() => scheduledQuery.fetchNextPage()}
                    disabled={scheduledQuery.isFetchingNextPage}
                  >
                    {scheduledQuery.isFetchingNextPage ? "טוען..." : "טען עוד"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Compose ── */}
        <TabsContent value="compose">
          <div className="max-w-2xl flex flex-col gap-4">

            {/* Recipient */}
            <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">נמען</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={recipientMode === "group" ? "default" : "outline"}
                  className="flex-1"
                  type="button"
                  onClick={() => handleRecipientModeChange("group")}
                >
                  קבוצת WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant={recipientMode === "coaches" ? "default" : "outline"}
                  className="flex-1"
                  type="button"
                  disabled={msgType === "group_settings"}
                  onClick={() => handleRecipientModeChange("coaches")}
                >
                  מאמנים
                </Button>
              </div>
              {isLoadingRecipients ? (
                <Skeleton className="h-9 w-full rounded-md" />
              ) : (
                <Select value={chatId} onValueChange={(val) => { if (val) handleRecipientChange(val); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={recipientMode === "group" ? "בחר קבוצה..." : "בחר מאמן..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {recipientMode === "group"
                      ? (groupData?.groups ?? []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))
                      : (
                        <>
                          <SelectItem value="coaches:all">כל המאמנים</SelectItem>
                          {(coachData?.coaches ?? [])
                            .filter((c) => c.phone)
                            .map((c) => (
                              <SelectItem key={c.email} value={`coach:${c.email}`}>{c.name}</SelectItem>
                            ))}
                        </>
                      )}
                  </SelectContent>
                </Select>
              )}
              {recipientMode === "group" && groupsError && (
                <p className="text-xs text-destructive mt-1">
                  שגיאה בטעינת קבוצות הוואטסאפ — בדוק את חיבור ה-Green API
                </p>
              )}
              {recipientMode === "group" && !loadingGroups && !groupsError && (groupData?.groups.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  לא נמצאו קבוצות — המספר המחובר צריך להיות חבר בקבוצה בוואטסאפ
                </p>
              )}
            </section>

            {/* Message */}
            <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-4 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">הודעה</p>

              {/* Type selector */}
              <div className="flex gap-2">
                {([
                  { value: "text" as const, label: "טקסט", Icon: MessageSquare },
                  { value: "image" as const, label: "תמונה", Icon: Image },
                  { value: "poll" as const, label: "סקר", Icon: BarChart2 },
                  { value: "group_settings" as const, label: "הגדרות קבוצה", Icon: Lock },
                ]).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleMsgTypeChange(value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all duration-150",
                      msgType === value
                        ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Text */}
              {msgType === "text" && (
                <div className="flex flex-col gap-2">
                  <WhatsAppTemplatePicker key={composeKey} onApply={setText} />
                  <Textarea
                    rows={10}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="כתוב את ההודעה..."
                    className="resize-y text-sm leading-relaxed min-h-[120px]"
                    dir="auto"
                  />
                </div>
              )}

              {/* Image */}
              {msgType === "image" && (
                <div className="flex flex-col gap-3">
                  {/* URL input */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">קישור לתמונה</Label>
                    <Input
                      value={imageFileName ? "" : imageUrl}
                      onChange={(e) => { setImageFileName(""); setImageUrl(e.target.value); }}
                      placeholder="https://..."
                      dir="ltr"
                      className="text-sm"
                      disabled={!!imageFileName || imageUploading}
                    />
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-xs text-muted-foreground">או</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>

                  {/* File upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setImageUrl(""); handleFileUpload(f); }
                      e.target.value = "";
                    }}
                  />
                  {imageFileName ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                      {imageUploading ? (
                        <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />
                      ) : (
                        <Image size={14} className="text-primary shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate text-muted-foreground">{imageFileName}</span>
                      {!imageUploading && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => { setImageFileName(""); setImageUrl(""); }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-all duration-150"
                    >
                      <Upload size={15} />
                      העלה תמונה מהמחשב
                    </button>
                  )}

                  {/* Preview */}
                  {imageUrl && !imageUploading && (
                    <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/30 max-h-56">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="תצוגה מקדימה"
                        className="max-h-56 w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Caption */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">כיתוב (אופציונלי)</Label>
                    <WhatsAppTemplatePicker key={composeKey} onApply={setImageCaption} />
                    <Textarea
                      rows={4}
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      placeholder="טקסט שיופיע מתחת לתמונה..."
                      className="resize-none text-sm mt-2"
                      dir="auto"
                    />
                  </div>
                </div>
              )}

              {/* Poll */}
              {msgType === "poll" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">שאלת הסקר</Label>
                    <WhatsAppTemplatePicker key={composeKey} onApply={setPollQuestion} />
                    <Input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="מה השאלה?"
                      dir="auto"
                      className="text-sm mt-2"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground block">אפשרויות</Label>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4 text-left shrink-0">{i + 1}.</span>
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollOptions];
                            next[i] = e.target.value;
                            setPollOptions(next);
                          }}
                          placeholder={`אפשרות ${i + 1}`}
                          dir="auto"
                          className="flex-1 h-8 text-sm"
                        />
                        {pollOptions.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                          >
                            <X size={13} />
                          </Button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 12 && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="self-start h-7 text-xs mt-1"
                        onClick={() => setPollOptions([...pollOptions, ""])}
                      >
                        <Plus size={12} className="ml-1" />
                        הוסף אפשרות
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Group settings */}
              {msgType === "group_settings" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground block">מצב הקבוצה</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={groupOpen === true ? "default" : "outline"}
                      className="flex-1"
                      type="button"
                      onClick={() => setGroupOpen(true)}
                    >
                      פתח קבוצה (כולם יכולים לשלוח)
                    </Button>
                    <Button
                      size="sm"
                      variant={groupOpen === false ? "default" : "outline"}
                      className="flex-1"
                      type="button"
                      onClick={() => setGroupOpen(false)}
                    >
                      סגור קבוצה (רק אדמינים)
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Schedule */}
            <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">תזמון שליחה</p>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </section>

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                disabled={!canSubmit}
                onClick={() => addMut.mutate()}
                className="min-w-28"
              >
                {addMut.isPending ? "שומר..." : "תזמן שליחה"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Automations ── */}
        <TabsContent value="automations">
          <WhatsAppAutomationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MessageCard({
  m,
  onDelete,
  onReschedule,
}: {
  m: ScheduledMessage;
  onDelete?: () => void;
  onReschedule?: () => void;
}) {
  const { label, variant } = STATUS_BADGE[m.status] ?? STATUS_BADGE.pending;
  const StatusIcon =
    m.status === "sent" ? CheckCircle2 : m.status === "failed" ? XCircle : Clock;
  const parsed = parseDisplay(m.message);
  const TypeIcon =
    parsed.type === "image" ? Image :
    parsed.type === "poll" ? BarChart2 :
    parsed.type === "group_settings" ? Lock :
    MessageSquare;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-start gap-3 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
      <StatusIcon
        size={15}
        className={cn(
          "mt-0.5 shrink-0",
          m.status === "sent" ? "text-emerald-500" : m.status === "failed" ? "text-destructive" : "text-muted-foreground"
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm">{m.chat_name || m.chat_id}</span>
          <Badge variant={variant} className="text-[10px] h-4 px-1.5">{label}</Badge>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <TypeIcon size={10} />
            {parsed.type === "image" ? "תמונה" : parsed.type === "poll" ? "סקר" : parsed.type === "group_settings" ? "הגדרות קבוצה" : "טקסט"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{parsed.preview}</p>
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
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
      {(m.status === "sent" || m.status === "failed") && onReschedule && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
          title="תזמן שוב"
          onClick={onReschedule}
        >
          <RotateCcw size={14} />
        </Button>
      )}
    </div>
  );
}

function AutomationBatchCard({
  batch,
  onDeleteBatch,
  onRescheduleMessage,
}: {
  batch: Extract<ListItem, { kind: "batch" }>;
  onDeleteBatch?: (runId: string) => void;
  onRescheduleMessage?: (m: ScheduledMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const earliest = [...batch.messages].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-right"
        >
          <ListChecks size={15} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{batch.automationName} · {batch.chatName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {batch.messages.length} שלבים · {formatLocalDatetime(earliest.scheduled_at)}
            </p>
          </div>
          <ChevronDown
            size={14}
            className={cn("text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")}
          />
        </button>
        {onDeleteBatch && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => onDeleteBatch(batch.runId)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {batch.messages.map((m) => (
            <MessageCard
              key={m.id}
              m={m}
              onReschedule={onRescheduleMessage ? () => onRescheduleMessage(m) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
