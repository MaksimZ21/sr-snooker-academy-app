"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2 } from "lucide-react";
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

  const { data: messages, isLoading } = useQuery({
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

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <Card key={m.id} className="cursor-pointer" onClick={() => onExpand(m.id, m.status)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-sm">{m.student_name}</span>
                  {m.student_phone && <span className="text-xs text-muted-foreground">{m.student_phone}</span>}
                  {m.status === "new" && <Badge className="text-xs">חדש</Badge>}
                  {m.status === "handled" && (
                    <Badge variant="secondary" className="text-xs">
                      טופל
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">{m.subject}</p>
                <p className={`text-sm text-muted-foreground ${expanded === m.id ? "" : "truncate"}`}>{m.message}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(m.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>

            {onMarkHandled && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={handling}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkHandled(m.id);
                  }}
                >
                  <CheckCircle2 size={14} className="ml-1.5" />
                  סמן כטופל
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
