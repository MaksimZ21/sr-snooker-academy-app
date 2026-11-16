"use client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2 , MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { ContactRequest } from "@/lib/sheets/contact";

async function fetchMessages(): Promise<ContactRequest[]> {
  const res = await fetch("/api/admin/messages");
  if (!res.ok) throw new Error("שגיאה בטעינת הפניות");
  const data = (await res.json()) as { requests: ContactRequest[] };
  return data.requests;
}

async function patchMessage(id: string, status: "read" | "handled"): Promise<void> {
  const res = await fetch("/api/admin/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error("שגיאה בעדכון הפנייה");
}

export function AdminMessages() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: messages, isLoading, isError } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: fetchMessages,
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: (id: string) => patchMessage(id, "read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
    onError: () => toast.error("שגיאה בסימון הפנייה כנקראה"),
  });

  const { mutate: markAsHandled, isPending: handling } = useMutation({
    mutationFn: (id: string) => patchMessage(id, "handled"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
    onError: () => toast.error("שגיאה בסימון הפנייה כטופלה"),
  });

  function handleExpand(id: string, status: string) {
    setExpanded(expanded === id ? null : id);
    if (status === "new") markAsRead(id);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        שגיאה בטעינת הפניות
      </div>
    );
  }

  const all = messages ?? [];
  const open = all.filter((m) => m.status !== "handled");
  const handled = all.filter((m) => m.status === "handled");

  return (
    <Tabs defaultValue="open" dir="rtl">
      <TabsList>
        <TabsTrigger value="open">פתוחות{open.length > 0 ? ` (${open.length})` : ""}</TabsTrigger>
        <TabsTrigger value="handled">טופלו{handled.length > 0 ? ` (${handled.length})` : ""}</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="mt-3">
        <MessageList
          messages={open}
          expanded={expanded}
          onExpand={handleExpand}
          onMarkHandled={(id) => markAsHandled(id)}
          handling={handling}
          emptyText="אין פניות פתוחות"
        />
      </TabsContent>
      <TabsContent value="handled" className="mt-3">
        <MessageList messages={handled} expanded={expanded} onExpand={handleExpand} emptyText="אין פניות שטופלו" />
      </TabsContent>
    </Tabs>
  );
}

function MessageList({
  messages,
  expanded,
  onExpand,
  onMarkHandled,
  handling,
  emptyText,
}: {
  messages: ContactRequest[];
  expanded: string | null;
  onExpand: (id: string, status: string) => void;
  onMarkHandled?: (id: string) => void;
  handling?: boolean;
  emptyText: string;
}) {
  if (messages.length === 0) {
    return <p className="text-muted-foreground text-center py-12">{emptyText}</p>;
  }

  // An inbox: one row per message, unread marked, reply on WhatsApp in one tap.
  return (
    <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
      {messages.map((m) => {
        const digits = m.student_phone.replace(/\D/g, "");
        const wa = digits ? `https://wa.me/${digits.startsWith("972") ? digits : digits.startsWith("0") ? `972${digits.slice(1)}` : digits}` : null;
        const open = expanded === m.id;
        return (
          <div
            key={m.id}
            className={cn("flex gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-muted/40", m.status === "new" && "bg-primary/5")}
            onClick={() => onExpand(m.id, m.status)}
          >
            <span className={cn("mt-1.5 w-2.5 h-2.5 rounded-full shrink-0", m.status === "new" ? "bg-primary" : "bg-transparent")} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("text-[15px] truncate", m.status === "new" ? "font-extrabold" : "font-semibold")}>{m.student_name}</span>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {new Date(m.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded-md bg-sidebar text-white px-2 py-0.5 font-display text-[11px] font-bold shrink-0">{m.subject}</span>
                {m.status === "handled" && (
                  <span className="rounded-md bg-muted text-muted-foreground px-2 py-0.5 font-display text-[11px] font-bold shrink-0">טופל</span>
                )}
                <p className={cn("text-sm text-muted-foreground min-w-0", open ? "whitespace-pre-wrap" : "truncate")}>{m.message}</p>
              </div>
              {(open || onMarkHandled) && (
                <div className="flex flex-wrap items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#25d366] text-white font-display text-xs font-bold hover:opacity-90"
                    >
                      <MessageCircle size={14} />
                      ענה בוואטסאפ
                    </a>
                  )}
                  {m.student_phone && (
                    <a href={`tel:${m.student_phone}`} className="text-xs text-muted-foreground tabular-nums hover:text-primary" dir="ltr">
                      {m.student_phone}
                    </a>
                  )}
                  {onMarkHandled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ms-auto"
                      disabled={handling}
                      onClick={() => onMarkHandled(m.id)}
                    >
                      <CheckCircle2 size={14} />
                      סמן כטופל
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
