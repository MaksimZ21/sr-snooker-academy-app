import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DriveLibrary } from "@/components/drive-library";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<BookOpen size={20} />} title="הנחיות" subtitle="חומרי עזר ומסמכים" />
      <DriveLibrary />
    </div>
  );
}
