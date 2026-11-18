import { Suspense } from "react";
import { notFound } from "next/navigation";
import { fetchPublicTournament, fetchPublicTournamentType } from "@/lib/sheets/tournaments-public";
import { PublicTournamentView } from "@/components/public-tournament-view";
import { AppSplash } from "@/components/app-splash";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const type = await fetchPublicTournamentType(slug);
  if (!type) notFound();
  // Multi-location tournaments run under ISPA — no academy branding while loading.
  return (
    <Suspense fallback={<AppSplash variant={type === "multi_location" ? "ispa" : "academy"} />}>
      <TournamentContent slug={slug} />
    </Suspense>
  );
}

async function TournamentContent({ slug }: { slug: string }) {
  const tournament = await fetchPublicTournament(slug);
  if (!tournament) notFound();
  return <PublicTournamentView slug={slug} initialTournament={tournament} />;
}
