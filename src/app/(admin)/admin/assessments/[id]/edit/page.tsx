"use client";
import { use } from "react";
import { AssessmentEditView } from "@/components/assessment-edit-view";

export default function EditAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AssessmentEditView assessmentId={id} returnPath={`/admin/assessments/${id}`} />;
}
