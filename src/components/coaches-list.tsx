"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { History, Trash2, Pencil, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddCoachDialog } from "@/components/forms/add-coach-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Coach = { email: string; name: string; phone: string; active: boolean };

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

export function CoachesList() {
  const [toDelete, setToDelete] = useState<Coach | null>(null);
  const [toEdit, setToEdit] = useState<Coach | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const qc = useQueryClient();

  function openEdit(c: Coach) {
    setEditName(c.name);
    setEditPhone(c.phone);
    setToEdit(c);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    staleTime: 5 * 60_000,
  });

  const editMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/coaches", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: toEdit!.email, name: editName, phone: editPhone }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הפרטים עודכנו");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setToEdit(null);
    },
    onError: () => toast.error("שגיאה בעדכון הפרטים"),
  });

  const deleteMut = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/coaches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המאמן נמחק");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setToDelete(null);
    },
    onError: () => toast.error("שגיאה במחיקת המאמן"),
  });

  const coaches = data?.coaches ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Users size={20} />}
        title="מאמנים"
        subtitle={isLoading ? "טוען..." : `${coaches.length} מאמנים רשומים`}
        action={<AddCoachDialog />}
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">

      {/* List */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm shadow-foreground/[0.04] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : coaches.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין מאמנים עדיין</div>
        ) : (
          <div className="divide-y divide-border/40">
            {coaches.map((c) => (
              <CoachRow
                key={c.email}
                coach={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setToDelete(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!toEdit} onOpenChange={(v) => { if (!v) setToEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת מאמן</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">{toEdit?.email}</div>
          <div className="grid gap-3">
            <div>
              <Label>שם</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="05X-XXXXXXX" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToEdit(null)} disabled={editMut.isPending}>ביטול</Button>
            <Button disabled={!editName.trim() || editMut.isPending} onClick={() => editMut.mutate()}>
              {editMut.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!toDelete} onOpenChange={(v) => { if (!v) setToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת מאמן</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            האם למחוק את <span className="font-semibold text-foreground">{toDelete?.name}</span>?
            הפעולה תסיר את המאמן מהמערכת ותבטל את גישתו.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleteMut.isPending}>ביטול</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => toDelete && deleteMut.mutate(toDelete.email)}
            >
              {deleteMut.isPending ? "מוחק..." : "מחק"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function CoachRow({ coach: c, onEdit, onDelete }: {
  coach: Coach;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const info = [c.email, c.phone].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 dark:hover:bg-white/[0.03]">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-[11px] font-bold shrink-0 select-none shadow-sm">
        {getInitials(c.name)}
      </div>

      {/* Name + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-none">{c.name}</span>
          {!c.active && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">לא פעיל</Badge>
          )}
        </div>
        {info && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info}</p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className={cn(
        "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
        "opacity-0 group-hover:opacity-100",
      )}>
        <Link
          href={`/admin/coaches/sessions?coach=${encodeURIComponent(c.email)}`}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="מפגשים"
        >
          <History size={14} />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="עריכה"
          onClick={onEdit}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="מחיקה"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
