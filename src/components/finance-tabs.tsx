"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalaryView } from "@/components/salary-view";
import { StudentPaymentsView } from "@/components/student-payments-view";

export type FinanceTab = "coaches" | "students";

// Admin finance: coach pay on one tab, trainee payments on the other.
export function FinanceTabs({ initialTab }: { initialTab: FinanceTab }) {
  const [tab, setTab] = useState<FinanceTab>(initialTab);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as FinanceTab)} dir="rtl" className="pt-4">
      <TabsList className="mx-4">
        <TabsTrigger value="coaches">מאמנים</TabsTrigger>
        <TabsTrigger value="students">מתאמנים</TabsTrigger>
      </TabsList>
      <TabsContent value="coaches">
        <SalaryView />
      </TabsContent>
      <TabsContent value="students" className="p-4 pb-8">
        <StudentPaymentsView />
      </TabsContent>
    </Tabs>
  );
}
