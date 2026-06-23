import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WhatsAppScheduler } from "@/components/whatsapp-scheduler";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<MessageCircle size={20} />} title="WhatsApp" subtitle="תזמון ושליחת הודעות" />
      <WhatsAppScheduler />
    </div>
  );
}
