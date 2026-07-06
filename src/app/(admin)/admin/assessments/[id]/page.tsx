"use client";
import { use } from "react";
import { AssessmentDetailView } from "@/components/assessment-detail-view";

export default function AdminAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AssessmentDetailView
      assessmentId={id}
      backHref="/admin/assessments"
      backLabel="דוחות אבחון"
      showCoach
    />
  );
}
