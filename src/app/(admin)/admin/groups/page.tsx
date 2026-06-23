import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GroupsList } from "@/components/groups-list";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<LayoutGrid size={20} />} title="קבוצות" subtitle="ניהול קבוצות ומתאמנים" />
      <GroupsList />
    </div>
  );
}
