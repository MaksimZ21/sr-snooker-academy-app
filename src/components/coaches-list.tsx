"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { Phone, History, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddCoachDialog } from "@/components/forms/add-coach-dialog";
import { toast } from "sonner";

type Coach = { email: string; name: string; phone: string; active: boolean };

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ניהול רשימת המאמנים</p>
        <AddCoachDialog />
      </div>
      {(data?.coaches ?? []).map((c) => (
        <Card key={c.email} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center text-sm font-bold shrink-0 select-none shadow-md ring-2 ring-primary/20">
                {getInitials(c.name)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-sm text-muted-foreground truncate">{c.email}</div>
                {c.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone size={11} />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/admin/coaches/sessions?coach=${encodeURIComponent(c.email)}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <History size={13} />
                <span>מפגשים</span>
              </Link>
              <Badge variant={c.active ? "default" : "secondary"}>
                {c.active ? "פעיל" : "לא פעיל"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => openEdit(c)}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setToDelete(c)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!toEdit} onOpenChange={(v) => { if (!v) setToEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת מאמן</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-1">{toEdit?.email}</div>
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
            <Button variant="outline" onClick={() => setToEdit(null)} disabled={editMut.isPending}>
              ביטול
            </Button>
            <Button
              disabled={!editName.trim() || editMut.isPending}
              onClick={() => editMut.mutate()}
            >
              {editMut.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleteMut.isPending}>
              ביטול
            </Button>
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
  );
}
