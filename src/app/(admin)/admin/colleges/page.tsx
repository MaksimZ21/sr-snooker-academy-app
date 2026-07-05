import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CollegesList } from "@/components/colleges-list";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Building2 size={20} />} title="מכללות" subtitle="ניהול רשימת המכללות" />
      <CollegesList />
    </div>
  );
}
