"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Plus, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tournament = { id: string; name: string; manager_email: string; completed: boolean; public_slug: string };
type Coach = { email: string; name: string; phone: string };

export default function AdminTournamentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [rulesUrl, setRulesUrl] = useState("");
  const [handicapGap, setHandicapGap] = useState("20");

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const r = await fetch("/api/tournaments");
      return (await r.json()) as { tournaments: Tournament[] };
    },
  });

  const { data: coachData } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          manager_email: managerEmail,
          rules_url: rulesUrl.trim() || undefined,
          handicap_points_per_rating_gap: Number(handicapGap) || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { tournament: Tournament };
    },
    onSuccess: ({ tournament }) => {
      toast.success("הטורניר נוצר");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      setOpen(false);
      setName("");
      setManagerEmail("");
      setRulesUrl("");
      setHandicapGap("20");
      router.push(`/admin/tournaments/${tournament.id}`);
    },
    onError: () => toast.error("שגיאה ביצירה"),
  });

  const tournaments = data?.tournaments ?? [];
  const active = tournaments.filter((t) => !t.completed);
  const completed = tournaments.filter((t) => t.completed);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Trophy size={20} />}
        title="טורנירים"
        subtitle={isLoading ? "טוען..." : `${tournaments.length} טורנירים`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus size={14} className="ml-1.5" />
              טורניר חדש
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>טורניר חדש</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שם הטורניר</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">מאמן אחראי</Label>
                  <Select value={managerEmail} onValueChange={(v) => setManagerEmail(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מאמן..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(coachData?.coaches ?? []).map((c) => (
                        <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">קישור לתקנון (אופציונלי)</Label>
                  <Input value={rulesUrl} onChange={(e) => setRulesUrl(e.target.value)} dir="ltr" placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">מקדם פור (ברירת מחדל 20)</Label>
                  <Input type="number" value={handicapGap} onChange={(e) => setHandicapGap(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
                  ביטול
                </Button>
                <Button onClick={() => createMut.mutate()} disabled={!name.trim() || !managerEmail || createMut.isPending}>
                  {createMut.isPending ? "יוצר..." : "צור"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <TournamentGroup title="פעילים" items={active} basePath="/admin" />
            {completed.length > 0 && <TournamentGroup title="הסתיימו" items={completed} basePath="/admin" />}
          </>
        )}
      </div>
    </div>
  );
}

function TournamentGroup({ title, items, basePath }: { title: string; items: Tournament[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          אין טורנירים
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((t) => (
          <Link
            key={t.id}
            href={`${basePath}/tournaments/${t.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{t.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
