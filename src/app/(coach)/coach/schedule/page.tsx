import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WeeklyGrid } from "@/components/weekly-grid";

export default function CoachSchedulePage() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<CalendarRange size={20} />} title="הלוז שלי" subtitle="לוח זמנים שבועי" />
      <WeeklyGrid basePath="coach" />
    </div>
  );
}
