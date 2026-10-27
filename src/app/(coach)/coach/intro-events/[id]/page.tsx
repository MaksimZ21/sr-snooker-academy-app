import { IntroEventDetailView } from "@/components/intro-event-detail-view";

export default async function CoachIntroEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <IntroEventDetailView introEventId={id} backHref="/coach/schedule" isAdmin={false} />
  );
}
