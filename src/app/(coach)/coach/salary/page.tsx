import { SessionsList } from "@/components/sessions-list";

export default function CoachSalaryPage() {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">פיננסים</h1>
        <p className="text-sm text-muted-foreground mt-0.5">אימונים ותשלומים לפי חודש</p>
      </div>
      <SessionsList basePath="coach" />
    </div>
  );
}
