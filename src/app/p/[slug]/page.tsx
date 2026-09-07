import { notFound } from "next/navigation";
import { fetchPublicPlayer } from "@/lib/sheets/tournaments-public";
import { PublicPlayerView } from "@/components/public-player-view";

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const player = await fetchPublicPlayer(slug);
  if (!player) notFound();
  return <PublicPlayerView player={player} />;
}
