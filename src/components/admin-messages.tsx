"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactRequest } from "@/lib/sheets/contact";

async function fetchMessages(): Promise<ContactRequest[]> {
  const res = await fetch("/api/admin/messages");
  const data = await res.json() as { requests: ContactRequest[] };
  return data.requests;
}

async function markRead(id: string): Promise<void> {
  await fetch("/api/admin/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export function AdminMessages() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: fetchMessages,
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
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

  if (!messages?.length) {
    return <p className="text-muted-foreground text-center py-12">אין פניות עדיין</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <Card
          key={m.id}
          className="cursor-pointer"
          onClick={() => handleExpand(m.id, m.status)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{m.subject}</span>
                  {m.status === "new" && <Badge className="text-xs">חדש</Badge>}
                </div>
                <p
                  className={`text-sm text-muted-foreground ${
                    expanded === m.id ? "" : "truncate"
                  }`}
                >
                  {m.message}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(m.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
