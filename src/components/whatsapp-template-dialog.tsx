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
import { toast } from "sonner";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import type { WhatsAppTemplate } from "@/app/api/whatsapp/templates/route";

async function fetchTemplates(): Promise<WhatsAppTemplate[]> {
  const r = await fetch("/api/whatsapp/templates");
  if (!r.ok) throw new Error("fetch failed");
  const json = (await r.json()) as { templates: WhatsAppTemplate[] };
  return json.templates;
}

function TemplateForm({
  template,
  onDone,
}: {
  template?: WhatsAppTemplate;
  onDone: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const r = template
        ? await fetch(`/api/whatsapp/templates/${template.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, body }),
          })
        : await fetch("/api/whatsapp/templates", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, body }),
          });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(template ? "תבנית עודכנה" : "תבנית נוצרה");
      qc.invalidateQueries({ queryKey: ["whatsapp:templates"] });
      onDone();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">שם התבנית</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="תזכורת אימון" dir="auto" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">טקסט</Label>
        <Textarea
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"לדוגמה: תזכורת לאימון ב-{{תאריך}} בשעה {{שעה}}"}
          className="resize-y text-sm leading-relaxed"
          dir="auto"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mut.isPending}>
          ביטול
        </Button>
        <Button onClick={() => mut.mutate()} disabled={!name.trim() || !body.trim() || mut.isPending}>
          {mut.isPending ? "שומר..." : "שמור"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function WhatsAppTemplatesDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<WhatsAppTemplate | undefined>(undefined);
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp:templates"],
    queryFn: fetchTemplates,
    enabled: open,
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("תבנית נמחקה");
      qc.invalidateQueries({ queryKey: ["whatsapp:templates"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode("list");
      setEditing(undefined);
    }
  }

  function openCreate() {
    setEditing(undefined);
    setMode("form");
  }

  function openEdit(t: WhatsAppTemplate) {
    setEditing(t);
    setMode("form");
  }

  function backToList() {
    setMode("list");
    setEditing(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
        <FileText className="ml-2 h-4 w-4" />
        תבניות
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "list" ? "תבניות הודעה" : editing ? "עריכת תבנית" : "תבנית חדשה"}</DialogTitle>
        </DialogHeader>

        {mode === "form" ? (
          <TemplateForm template={editing} onDone={backToList} />
        ) : (
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">טוען...</div>
            ) : (templates ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">אין תבניות עדיין</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {(templates ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deleteMut.isPending}
                        onClick={() => deleteMut.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="ml-2 h-4 w-4" />
                תבנית חדשה
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
