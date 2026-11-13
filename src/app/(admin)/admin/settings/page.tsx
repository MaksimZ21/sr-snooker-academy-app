import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FoldSection } from "@/components/fold-section";
import { SessionPricingTable } from "@/components/session-pricing-table";
import { SettingsLevelsEditor } from "@/components/settings-levels-editor";
import { SettingsHandicapTable } from "@/components/settings-handicap-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Settings size={20} />} title="הגדרות" subtitle="תמחור אימונים, דרגות וטבלת פור" />
      <div className="p-4 flex flex-col gap-6">
        <FoldSection title="טבלת פור לפי מחוז" storageKey="settings:handicap">
          <SettingsHandicapTable />
        </FoldSection>
        <FoldSection title="דרגות" storageKey="settings:levels">
          <SettingsLevelsEditor />
        </FoldSection>
        <FoldSection title="תמחור אימונים" storageKey="settings:session-pricing">
          <p className="text-xs text-muted-foreground">כללי תמחור אוטומטי לפי שם האימון</p>
          <div className="rounded-2xl border border-border/60 bg-card">
            <SessionPricingTable />
          </div>
        </FoldSection>
      </div>
    </div>
  );
}
