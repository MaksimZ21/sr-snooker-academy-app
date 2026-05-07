import { SessionsList } from "@/components/sessions-list";
import { fetchSessionsForCoach } from "@/lib/sheets/sessions";
import { notFound } from "next/navigation";
import type { SearchParams } from "next/dist/server/request/search-params";

export default async function AdminCoachSessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { coach } = await searchParams;
  const coachEmail = typeof coach === "string" ? coach : null;
  if (!coachEmail) notFound();

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">מפגשי מאמן</h1>
        <p className="text-sm text-muted-foreground mt-0.5 font-mono">{coachEmail}</p>
      </div>
      <SessionsList basePath="admin" coachEmail={coachEmail} />
    </div>
  );
}
