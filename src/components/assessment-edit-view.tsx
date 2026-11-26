"use client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentForm } from "@/components/assessment-form";
import type { Assessment } from "@/lib/sheets/assessment-types";

// Loads a saved report and opens it in the report form for editing.
export function AssessmentEditView({ assessmentId, returnPath }: { assessmentId: string; returnPath: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const r = await fetch(`/api/assessments/${assessmentId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { assessment: Assessment };
    },
  });

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="bc-num text-[26px] md:text-[32px] leading-[1.05]">עריכת דוח אבחון</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {data ? data.assessment.participant_name : "טוען..."}
        </p>
      </div>
      {isError ? (
        <p className="p-4 text-sm text-muted-foreground">הדוח לא נמצא</p>
      ) : isLoading || !data ? (
        <div className="p-4 flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <AssessmentForm key={data.assessment.id} existing={data.assessment} returnPath={returnPath} />
      )}
    </div>
  );
}
