"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { College } from "@/lib/sheets/colleges";

export function CollegesCard() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["colleges"],
    queryFn: async () => {
      const r = await fetch("/api/colleges");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { colleges: College[] };
    },
    staleTime: 60_000,
  });

  const addMut = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch("/api/colleges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("מכללה נוספה");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["colleges"] });
    },
    onError: () => toast.error("שגיאה בהוספה"),
  });

  const editMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const r = await fetch(`/api/colleges/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("עודכן");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["colleges"] });
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/colleges/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("נמחקה");
      qc.invalidateQueries({ queryKey: ["colleges"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Building2 size={14} />
          מכללות
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder="שם מכללה חדשה..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) addMut.mutate(newName.trim());
            }}
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => addMut.mutate(newName.trim())}
            disabled={!newName.trim() || addMut.isPending}
          >
            <Plus size={14} className="ml-1" />
            הוסף
          </Button>
        </div>

        {/* List */}
        <div className="flex flex-col divide-y divide-border/60">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="py-2">
                <Skeleton className="h-7 w-full rounded" />
              </div>
            ))
          ) : !data?.colleges.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">אין מכללות עדיין</p>
          ) : (
            data.colleges.map((college) => (
              <div key={college.id} className="flex items-center gap-2 py-1.5">
                {editingId === college.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingName.trim())
                          editMut.mutate({ id: college.id, name: editingName.trim() });
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600 shrink-0"
                      onClick={() => editMut.mutate({ id: college.id, name: editingName.trim() })}
                      disabled={!editingName.trim() || editMut.isPending}
                    >
                      <Check size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={13} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{college.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => { setEditingId(college.id); setEditingName(college.name); }}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate(college.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
