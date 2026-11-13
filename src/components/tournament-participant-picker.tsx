"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { hasStudentNamed } from "@/lib/student-name";

type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

const NO_LOCATION = "__none__";

export function TournamentParticipantPicker({
  tournamentId,
  multiLocation,
  locations,
}: {
  tournamentId: string;
  // A multi-location tournament's participants are local to it — a plain
  // name, never a search/create against the students table. See
  // docs/superpowers/specs/2026-09-17-multi-location-local-participants-design.md.
  multiLocation?: boolean;
  // Multi-location only: where a pasted list can go straight to.
  locations?: { id: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLocation, setBulkLocation] = useState(NO_LOCATION);
  const bulkNames = bulkText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["students:search", query],
    queryFn: async () => {
      const r = await fetch(`/api/students/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("search failed");
      return (await r.json()) as { students: StudentSearchResult[] };
    },
    enabled: !multiLocation && query.trim().length >= 2,
  });

  const addMut = useMutation({
    mutationFn: async (body: { studentId?: string; newStudentName?: string; localName?: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("משתתף נוסף");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בהוספת משתתף"),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          localNames: bulkNames,
          locationId: bulkLocation === NO_LOCATION ? null : bulkLocation,
        }),
      });
      const body = (await r.json().catch(() => null)) as { added?: number; skipped?: number; error?: string } | null;
      if (!r.ok) throw new Error(body?.error ?? "שגיאה בהוספת הרשימה");
      return { added: body?.added ?? 0, skipped: body?.skipped ?? 0 };
    },
    onSuccess: ({ added, skipped }) => {
      toast.success(skipped ? `נוספו ${added} משתתפים (${skipped} כבר היו בטורניר)` : `נוספו ${added} משתתפים`);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהוספת הרשימה"),
  });

  if (multiLocation) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="שם המשתתף" dir="auto" />
          </div>
          <Button onClick={() => addMut.mutate({ localName: query.trim() })} disabled={!query.trim() || addMut.isPending}>
            הוסף
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setBulkOpen((v) => !v)}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          {bulkOpen ? "סגור הוספת רשימה" : "+ הוספת רשימת משתתפים (הדבקה)"}
        </button>
        {bulkOpen && (
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
            <p className="text-xs text-muted-foreground">
              שם אחד בכל שורה. מספור בתחילת שורה (1. / 2)) יורד לבד. שמות שכבר בטורניר ידולגו.
            </p>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"ישראל ישראלי\nדני כהן\n..."}
              dir="auto"
              rows={8}
            />
            <div className="flex items-center gap-2 flex-wrap">
              {(locations?.length ?? 0) > 0 && (
                <Select value={bulkLocation} onValueChange={(v) => setBulkLocation(v ?? NO_LOCATION)}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCATION}>ללא מיקום</SelectItem>
                    {locations?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => bulkMut.mutate()} disabled={bulkNames.length === 0 || bulkMut.isPending}>
                הוסף {bulkNames.length || ""} משתתפים
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const results = data?.students ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חפש שם או טלפון..."
        dir="auto"
      />
      {query.trim().length >= 2 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {isLoading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">מחפש...</div>
          ) : isError ? (
            <div className="px-3 py-3 text-sm text-destructive text-center">שגיאה בחיפוש, נסה שוב</div>
          ) : (
            <>
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addMut.mutate({ studentId: s.id })}
                  disabled={addMut.isPending}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors text-sm border-b border-border/40 last:border-b-0"
                >
                  <span className="flex-1">{[s.first_name, s.last_name].filter(Boolean).join(" ")}</span>
                  {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addMut.mutate({ newStudentName: query.trim() })}
                disabled={addMut.isPending}
                className="w-full text-right px-3 py-2 hover:bg-muted/60 transition-colors text-sm text-primary border-t border-border/40"
              >
                {hasStudentNamed(results, query)
                  ? `כבר קיים שחקן בשם הזה. להוסיף בכל זאת משתתף נוסף: "${query.trim()}"`
                  : `+ הוסף כמשתתף חדש: "${query.trim()}"`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
