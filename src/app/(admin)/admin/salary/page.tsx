import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceTabs } from "@/components/finance-tabs";

export default async function SalaryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<Banknote size={20} />}
        title="פיננסים"
        subtitle="שכר מאמנים ותשלומי מתאמנים"
      />
      <FinanceTabs initialTab={tab === "students" ? "students" : "coaches"} />
    </div>
  );
}
