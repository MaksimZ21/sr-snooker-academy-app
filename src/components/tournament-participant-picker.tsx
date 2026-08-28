"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

export function TournamentParticipantPicker({ tournamentId }: { tournamentId: string }) {
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["students:search", query],
    queryFn: async () => {
      const r = await fetch(`/api/students/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("search failed");
      return (await r.json()) as { students: StudentSearchResult[] };
    },
    enabled: query.trim().length >= 2,
  });

  const addMut = useMutation({
    mutationFn: async (body: { studentId?: string; newStudentName?: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("משתתף נוסף");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת משתתף"),
  });

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
                {`+ הוסף כמשתתף חדש: "${query.trim()}"`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
