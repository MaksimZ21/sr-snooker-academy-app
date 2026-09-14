import { LeagueDetailView } from "@/components/league-detail-view";

export default async function CoachLeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LeagueDetailView leagueId={id} backHref="/coach/leagues" isAdmin={false} />
  );
}
