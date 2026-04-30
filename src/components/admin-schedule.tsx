"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WeeklyGrid } from "./weekly-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddSessionDialog } from "@/components/forms/add-session-dialog";

type Coach = { email: string; name: string; active: boolean };

export function AdminSchedule() {
  const [coach, setCoach] = useState<string>("all");
  const { data } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
  });

  return (
    <div>
      <div className="p-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="max-w-xs">
          <Select value={coach} onValueChange={(v) => setCoach(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="כל המאמנים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המאמנים</SelectItem>
              {(data?.coaches ?? [])
                .filter((c) => c.active)
                .map((c) => (
                  <SelectItem key={c.email} value={c.email}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <AddSessionDialog />
      </div>
      <WeeklyGrid
        basePath="admin"
        coachFilter={coach === "all" ? undefined : coach}
      />
    </div>
  );
}
