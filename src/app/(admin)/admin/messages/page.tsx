import { AdminMessages } from "@/components/admin-messages";

export default function AdminMessagesPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">פניות מתאמנים</h1>
      <p className="text-muted-foreground mb-6">הודעות שנשלחו מהאזור האישי</p>
      <AdminMessages />
    </div>
  );
}
