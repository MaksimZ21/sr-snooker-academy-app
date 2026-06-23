import { SessionsList } from "@/components/sessions-list";
import { fetchSessionsForCoach } from "@/lib/sheets/sessions";
import { notFound } from "next/navigation";
import type { SearchParams } from "next/dist/server/request/search-params";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        icon={<CalendarDays size={20} />}
        title="מפגשי מאמן"
        subtitle={coachEmail}
      />
      <SessionsList basePath="admin" coachEmail={coachEmail} />
    </div>
  );
}
