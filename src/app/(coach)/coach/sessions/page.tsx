import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SessionsList } from "@/components/sessions-list";

export default function CoachSessionsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<CalendarDays size={20} />}
        title="האימונים שלי"
        subtitle="כל המפגשים שלך לפי חודש"
      />
      <SessionsList basePath="coach" />
    </div>
  );
}
