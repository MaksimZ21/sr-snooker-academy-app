import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CoachFinancesList } from "@/components/coach-finances-list";

export default function CoachSalaryPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<Banknote size={20} />}
        title="פיננסים"
        subtitle="אימונים ותשלומים לפי חודש"
      />
      <CoachFinancesList />
    </div>
  );
}
