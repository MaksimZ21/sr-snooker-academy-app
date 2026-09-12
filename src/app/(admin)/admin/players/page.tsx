import { Award } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PlayersTable } from "@/components/players-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Award size={20} />} title="שחקנים" subtitle="כל השחקנים שהשתתפו בטורנירים" />
      <PlayersTable />
    </div>
  );
}
