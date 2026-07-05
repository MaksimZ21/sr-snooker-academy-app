"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { College } from "@/lib/sheets/colleges";

export function CollegesList() {
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

  function startEdit(college: College) {
    setEditingId(college.id);
    setEditingName(college.name);
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 max-w-xl">
      {/* Add new */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="שם מכללה חדשה..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) addMut.mutate(newName.trim());
              }}
            />
            <Button
              onClick={() => addMut.mutate(newName.trim())}
              disabled={!newName.trim() || addMut.isPending}
              className="shrink-0"
            >
              <Plus size={16} className="ml-1" />
              הוסף
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="pt-4 flex flex-col divide-y divide-border/60">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-3">
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))
          ) : !data?.colleges.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין מכללות עדיין</p>
          ) : (
            data.colleges.map((college) => (
              <div key={college.id} className="flex items-center gap-2 py-2.5">
                {editingId === college.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 h-8"
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
                      className="h-8 w-8 text-green-600"
                      onClick={() => editMut.mutate({ id: college.id, name: editingName.trim() })}
                      disabled={!editingName.trim() || editMut.isPending}
                    >
                      <Check size={15} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={15} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{college.name}</span>
                    <span className="text-xs text-muted-foreground">{college.id}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(college)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate(college.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
