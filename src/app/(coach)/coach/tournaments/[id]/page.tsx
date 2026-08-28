import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TournamentDetailView } from "@/components/tournament-detail-view";

export default async function CoachTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return (
    <TournamentDetailView
      tournamentId={id}
      backHref="/coach/tournaments"
      currentEmail={session?.user.email ?? ""}
      isAdmin={false}
    />
  );
}
