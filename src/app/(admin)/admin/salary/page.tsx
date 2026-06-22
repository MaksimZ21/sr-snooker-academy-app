import { SalaryView } from "@/components/salary-view";

export default function SalaryPage() {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">פיננסים</h1>
        <p className="text-sm text-muted-foreground mt-0.5">תשלומים לפי חודש ומאמן</p>
      </div>
      <SalaryView />
    </div>
  );
}
