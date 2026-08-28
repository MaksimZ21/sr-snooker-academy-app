import { TournamentDetailView } from "@/components/tournament-detail-view";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TournamentDetailView tournamentId={id} backHref="/admin/tournaments" currentEmail="" isAdmin={true} />
  );
}
