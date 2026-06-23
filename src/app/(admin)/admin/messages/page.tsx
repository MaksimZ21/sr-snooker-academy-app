import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminMessages } from "@/components/admin-messages";

export default function AdminMessagesPage() {
  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full">
      <PageHeader
        icon={<MessageSquare size={20} />}
        title="פניות מתאמנים"
        subtitle="הודעות שנשלחו מהאזור האישי"
      />
      <div className="p-4">
        <AdminMessages />
      </div>
    </div>
  );
}
