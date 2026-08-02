import { z } from "zod";

const Bool = z.preprocess(
  (v) => String(v ?? "").trim().toUpperCase() === "TRUE",
  z.boolean(),
);

const Csv = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  z.array(z.string()),
);

export const StudentRow = z.object({
  id: z.string().min(1),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  college_name: z.string().default(""),
  subscription_type: z.string().default(""),
  general_notes: z.string().default(""),
  birth_date: z.string().nullable().default(null),
  last_payment_date: z.string().nullable().default(null),
  active: Bool,
});
export type Student = z.infer<typeof StudentRow>;

export function studentFullName(s: Pick<Student, "first_name" | "last_name">) {
  return [s.first_name, s.last_name].filter(Boolean).join(" ");
}

export const TrainingType = z.enum([
  "private",
  "group",
  "beginners",
  "advanced",
  "technique",
  "match-play",
]);

export const SessionRow = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string().default(""),
  coach_email: z.union([z.email(), z.literal("")]).default(""),
  training_type: TrainingType,
  student_ids: Csv,
  drive_folder_url: z.string().default(""),
  address: z.string().default(""),
  crm_event_id: z.string().default(""),
  crm_event_type: z.string().default(""),
  crm_appointment_id: z.string().default(""),
  group_id: z.string().nullable().default(null),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  price_nis: z.coerce.number().int().nullable().default(null),
  source: z.string().default(""),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
export type Session = z.infer<typeof SessionRow>;

export const AttendanceRow = z.object({
  session_id: z.string(),
  student_id: z.string(),
  status: z.enum(["present", "absent", "late", "confirmed"]),
  marked_by: z.string().min(1),
  marked_at: z.string(),
});
export type Attendance = z.infer<typeof AttendanceRow>;

export const NoteRow = z.object({
  id: z.string(),
  student_id: z.string(),
  session_id: z.string(),
  coach_email: z.email(),
  text: z.string(),
  created_at: z.string(),
});
export type Note = z.infer<typeof NoteRow>;

export const GuidelineRow = z.object({
  id: z.string(),
  category: z.string(),
  order: z.coerce.number().int(),
  training_type: z.string().default(""),
  title: z.string(),
  body_or_link: z.string(),
});
export type Guideline = z.infer<typeof GuidelineRow>;

export const PricingRow = z.object({
  lesson_type: z.string(),
  duration_min: z.coerce.number().int(),
  price_nis: z.coerce.number().int(),
  notes: z.string().default(""),
});
export type Pricing = z.infer<typeof PricingRow>;

export const GroupRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  student_ids: Csv,
  college_name: z.preprocess((v) => v ?? "", z.string()),
  coach_email: z.preprocess((v) => v ?? "", z.string()),
  start_time: z.preprocess((v) => v ?? "", z.string()),
});
export type Group = z.infer<typeof GroupRow>;

export function parseRows<T extends z.ZodTypeAny>(
  rows: string[][],
  schema: T,
): z.infer<T>[] {
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((col, i) => (obj[col] = r[i] ?? ""));
    return schema.parse(obj);
  });
}
