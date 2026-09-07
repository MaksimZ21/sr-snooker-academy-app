import { notFound } from "next/navigation";
import { fetchPublicTournament } from "@/lib/sheets/tournaments-public";
import { PublicTournamentView } from "@/components/public-tournament-view";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await fetchPublicTournament(slug);
  if (!tournament) notFound();
  return <PublicTournamentView tournament={tournament} />;
}
