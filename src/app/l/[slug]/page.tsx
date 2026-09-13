import { notFound } from "next/navigation";
import { fetchPublicLeague } from "@/lib/sheets/leagues-public";
import { PublicLeagueView } from "@/components/public-league-view";

export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await fetchPublicLeague(slug);
  if (!league) notFound();
  return <PublicLeagueView league={league} />;
}
