import { AssessmentForm } from "@/components/assessment-form";

type SearchParams = { name?: string; phone?: string; date?: string };

export default async function NewAssessmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { name, phone, date } = await searchParams;
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <h1 className="bc-num text-[26px] md:text-[32px] leading-[1.05]">דוח אבחון חדש</h1>
        <p className="text-sm text-muted-foreground mt-0.5">מלא את פרטי האבחון עבור משתתף האירוע</p>
      </div>
      <AssessmentForm initialName={name} initialPhone={phone} initialDate={date} />
    </div>
  );
}
