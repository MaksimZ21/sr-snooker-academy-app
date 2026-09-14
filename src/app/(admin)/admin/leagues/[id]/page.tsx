import { LeagueDetailView } from "@/components/league-detail-view";

export default async function AdminLeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LeagueDetailView leagueId={id} backHref="/admin/leagues" isAdmin={true} />
  );
}
