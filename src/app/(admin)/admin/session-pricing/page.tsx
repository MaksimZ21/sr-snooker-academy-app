import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SessionPricingTable } from "@/components/session-pricing-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Sparkles size={20} />} title="תמחור אימונים" subtitle="כללי תמחור אוטומטי לפי שם האימון" />
      <SessionPricingTable />
    </div>
  );
}
