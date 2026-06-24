import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WebhookLogsViewer } from "@/components/webhook-logs-viewer";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Activity size={20} />} title="לוגים CRM" subtitle="קריאות נכנסות מה-CRM" />
      <WebhookLogsViewer />
    </div>
  );
}
