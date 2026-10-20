import { NextResponse } from "next/server";
import { fetchPublicTournament } from "@/lib/sheets/tournaments-public";

// Deliberately unauthenticated — this mirrors the public /t/[slug] page
// itself, which is already meant for anyone with the link. Polled from the
// client (see PublicTournamentView) so a spectator sees new results without
// manually refreshing the page.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const tournament = await fetchPublicTournament(slug);
  if (!tournament) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tournament);
}
