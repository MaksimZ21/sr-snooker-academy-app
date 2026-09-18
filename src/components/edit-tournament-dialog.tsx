"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Coach = { email: string; name: string; phone: string };

type EditableTournament = {
  id: string;
  name: string;
  manager_email: string | null;
  rules_url: string | null;
  handicap_points_per_rating_gap: number;
  type: "regular" | "multi_location";
};

// Admin-only — there was previously no way at all to edit a tournament's
// details after creation, by hand or otherwise. This is also the only way
// a tournament created from a CRM event (which starts with no manager)
// ever gets one assigned. See
// docs/superpowers/specs/2026-09-18-crm-tournament-events-design.md.
export function EditTournamentDialog({ tournament }: { tournament: EditableTournament }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tournament.name);
  const [managerEmail, setManagerEmail] = useState(tournament.manager_email ?? "");
  const [rulesUrl, setRulesUrl] = useState(tournament.rules_url ?? "");
  const [handicapGap, setHandicapGap] = useState(String(tournament.handicap_points_per_rating_gap));

  const { data: coachData } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rules_url: rulesUrl.trim() || null,
          ...(tournament.type === "regular" && {
            manager_email: managerEmail,
            handicap_points_per_rating_gap: Number(handicapGap) || undefined,
          }),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("הטורניר עודכן");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tournament", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["tournaments:week"] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בעדכון"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil size={14} className="ml-1.5" />
        ערוך טורניר
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ערוך טורניר</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">שם הטורניר</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
          </div>
          {tournament.type === "regular" && (
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
          )}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">קישור לתקנון (אופציונלי)</Label>
            <Input value={rulesUrl} onChange={(e) => setRulesUrl(e.target.value)} dir="ltr" placeholder="https://..." />
          </div>
          {tournament.type === "regular" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">מקדם פור</Label>
              <Input type="number" value={handicapGap} onChange={(e) => setHandicapGap(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saveMut.isPending}>
            ביטול
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || (tournament.type === "regular" && !managerEmail) || saveMut.isPending}
          >
            {saveMut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
