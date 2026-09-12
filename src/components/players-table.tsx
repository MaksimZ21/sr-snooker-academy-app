"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Pencil, Check } from "lucide-react";
import type { Player } from "@/lib/sheets/players";

async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch("/api/admin/players");
  if (!res.ok) throw new Error("fetch failed");
  const data = (await res.json()) as { players: Player[] };
  return data.players;
}

async function patchRating(id: string, rating: number): Promise<void> {
  const res = await fetch(`/api/admin/players/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error("update failed");
}

export function PlayersTable() {
  const qc = useQueryClient();

  const { data: players, isLoading, isError } = useQuery({
    queryKey: ["admin-players"],
    queryFn: fetchPlayers,
  });

  const { mutate: saveRating, isPending: saving } = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => patchRating(id, rating),
    onSuccess: () => {
      toast.success("הדירוג עודכן");
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    },
    onError: () => toast.error("שגיאה בעדכון הדירוג"),
  });

  function copyLink(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("הקישור הועתק"))
      .catch(() => toast.error("שגיאה בהעתקת הקישור"));
  }

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        שגיאה בטעינת השחקנים
      </div>
    );
  }

  const rows = players ?? [];

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        עדיין אין שחקנים — שחקן מופיע כאן אחרי שהשתתף בטורניר אחד לפחות
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/40">
                <th className="text-right px-4 py-2 font-medium">שם</th>
                <th className="text-right px-2 py-2 font-medium">טלפון</th>
                <th className="text-center px-2 py-2 font-medium">דירוג</th>
                <th className="text-center px-2 py-2 font-medium">טורנירים</th>
                <th className="text-center px-2 py-2 font-medium">פרופיל</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PlayerRow
                  key={`${p.id}:${p.rating}`}
                  player={p}
                  onSaveRating={(rating) => saveRating({ id: p.id, rating })}
                  onCopyLink={() => copyLink(p.publicSlug)}
                  saving={saving}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  onSaveRating,
  onCopyLink,
  saving,
}: {
  player: Player;
  onSaveRating: (rating: number) => void;
  onCopyLink: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(player.rating));

  function save() {
    const n = Number(value);
    if (!Number.isInteger(n)) return;
    onSaveRating(n);
    setEditing(false);
  }

  return (
    <tr className="border-b border-border/20 last:border-b-0">
      <td className="px-4 py-2">{player.name}</td>
      <td className="px-2 py-2 text-muted-foreground">{player.phone || "—"}</td>
      <td className="px-2 py-2">
        {editing ? (
          <div className="flex items-center justify-center gap-1.5">
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 w-20 text-center px-1"
            />
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={saving} onClick={save}>
              <Check size={13} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <span className="tabular-nums font-medium">{player.rating}</span>
            <button
              type="button"
              onClick={() => {
                setValue(String(player.rating));
                setEditing(true);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="ערוך דירוג"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </td>
      <td className="text-center px-2 py-2 tabular-nums">{player.tournamentsPlayed}</td>
      <td className="text-center px-2 py-2">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCopyLink}>
          <Link2 size={13} className="ml-1" />
          העתק
        </Button>
      </td>
    </tr>
  );
}
