import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SalaryView } from "@/components/salary-view";

export default function SalaryPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<Banknote size={20} />}
        title="פיננסים"
        subtitle="הוצאות לפי מאמן ותקופה"
      />
      <SalaryView />
    </div>
  );
}
