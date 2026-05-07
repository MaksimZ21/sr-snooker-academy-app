import { SessionsList } from "@/components/sessions-list";

export default function CoachSessionsPage() {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">האימונים שלי</h1>
        <p className="text-sm text-muted-foreground mt-0.5">כל המפגשים שלך לפי חודש</p>
      </div>
      <SessionsList basePath="coach" />
    </div>
  );
}
