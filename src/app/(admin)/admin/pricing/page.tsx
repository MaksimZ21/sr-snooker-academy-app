import { Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PricingTable } from "@/components/pricing-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Tag size={20} />} title="מחירון" subtitle="תעריפים לפי סוג שיעור" />
      <PricingTable showAdd />
    </div>
  );
}
