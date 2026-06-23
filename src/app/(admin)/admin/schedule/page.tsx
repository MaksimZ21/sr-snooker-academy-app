import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSchedule } from "@/components/admin-schedule";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<CalendarRange size={20} />} title="לוז" subtitle="לוח זמנים שבועי" />
      <AdminSchedule />
    </div>
  );
}
