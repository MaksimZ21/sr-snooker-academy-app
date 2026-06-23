import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SessionsList } from "@/components/sessions-list";

export default function CoachSalaryPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<Banknote size={20} />}
        title="פיננסים"
        subtitle="אימונים ותשלומים לפי חודש"
      />
      <SessionsList basePath="coach" />
    </div>
  );
}
