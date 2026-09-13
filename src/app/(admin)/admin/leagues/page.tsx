"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Plus, ChevronLeft } from "lucide-react";
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

type League = { id: string; name: string; manager_email: string; completed: boolean };
type Coach = { email: string; name: string; phone: string };

export default function AdminLeaguesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [numCycles, setNumCycles] = useState("1");
  const [handicapGap, setHandicapGap] = useState("20");

  const { data, isLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const r = await fetch("/api/leagues");
      return (await r.json()) as { leagues: League[] };
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
      const r = await fetch("/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          manager_email: managerEmail,
          num_cycles: Number(numCycles) || undefined,
          handicap_points_per_rating_gap: Number(handicapGap) || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { league: League };
    },
    onSuccess: ({ league }) => {
      qc.invalidateQueries({ queryKey: ["leagues"] });
      setOpen(false);
      setName("");
      setManagerEmail("");
      setNumCycles("1");
      setHandicapGap("20");
      router.push(`/admin/leagues/${league.id}`);
    },
    onError: () => {},
  });

  const leagues = data?.leagues ?? [];
  const active = leagues.filter((l) => !l.completed);
  const completed = leagues.filter((l) => l.completed);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shield size={20} />}
        title="ליגות"
        subtitle={isLoading ? "טוען..." : `${leagues.length} ליגות`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus size={14} className="ml-1.5" />
              ליגה חדשה
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ליגה חדשה</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שם הליגה</Label>
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
                  <Label className="text-xs text-muted-foreground mb-1 block">מספר סיבובים (1 = כל זוג פעם אחת)</Label>
                  <Input type="number" min={1} value={numCycles} onChange={(e) => setNumCycles(e.target.value)} />
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
            <LeagueGroup title="פעילות" items={active} basePath="/admin" />
            {completed.length > 0 && <LeagueGroup title="הסתיימו" items={completed} basePath="/admin" />}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueGroup({ title, items, basePath }: { title: string; items: League[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          אין ליגות
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((l) => (
          <Link
            key={l.id}
            href={`${basePath}/leagues/${l.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{l.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
