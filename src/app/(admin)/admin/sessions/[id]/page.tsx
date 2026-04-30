import { notFound } from "next/navigation";
import { SessionDetail } from "@/components/session-detail";
import { ManageRosterDialog } from "@/components/forms/manage-roster-dialog";
import { fetchSessionById } from "@/lib/sheets/sessions";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await fetchSessionById(id);
  if (!session) notFound();
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 flex justify-end">
        <ManageRosterDialog
          sessionId={id}
          currentStudentIds={session.student_ids}
        />
      </div>
      <SessionDetail sessionId={id} canEditAttendance={true} canEditNotes={false} />
    </div>
  );
}
