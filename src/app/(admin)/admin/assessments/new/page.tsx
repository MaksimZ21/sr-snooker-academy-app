import { AssessmentForm } from "@/components/assessment-form";

export default function AdminNewAssessmentPage() {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">דוח אבחון חדש</h1>
        <p className="text-sm text-muted-foreground mt-0.5">מלא את פרטי האבחון עבור משתתף האירוע</p>
      </div>
      <AssessmentForm returnPath="/admin/assessments" />
    </div>
  );
}
