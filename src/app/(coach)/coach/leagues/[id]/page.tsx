import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeagueDetailView } from "@/components/league-detail-view";

export default async function CoachLeagueDetailPage({
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
    <LeagueDetailView
      leagueId={id}
      backHref="/coach/leagues"
      currentEmail={session?.user.email ?? ""}
      isAdmin={false}
    />
  );
}
