import { IntroEventDetailView } from "@/components/intro-event-detail-view";

export default async function AdminIntroEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <IntroEventDetailView introEventId={id} backHref="/admin/intro-events" isAdmin={true} />
  );
}
