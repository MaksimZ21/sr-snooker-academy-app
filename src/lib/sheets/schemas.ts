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

// The built-in level lists, best to worst. The real lists are editable on
// the settings page (skill_levels table); these are only the fallback.
export const SKILL_LEVELS = ["A", "B+", "B", "C+", "C", "D", "E"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

// Every player has two ratings: skill_level is the 12 ft one (the scale
// above, with pluses), skill_level_9ft the 9-10 ft one (plain A-E).
export const SKILL_LEVELS_9FT = ["A", "B", "C", "D", "E"] as const;

// Which table a tournament or league is played on. null = not set yet,
// treated as 12 ft (the only rating that existed before).
export const TABLE_SIZES = ["9-10", "12"] as const;
export type TableSize = (typeof TABLE_SIZES)[number];
export const TABLE_SIZE_LABEL: Record<TableSize, string> = { "9-10": "9-10 פיט", "12": "12 פיט" };

export function skillLevelsFor(size: TableSize | null | undefined): readonly string[] {
  return size === "9-10" ? SKILL_LEVELS_9FT : SKILL_LEVELS;
}

export function levelForTable(
  s: { skill_level: string | null; skill_level_9ft?: string | null },
  size: TableSize | null | undefined,
): string | null {
  return size === "9-10" ? (s.skill_level_9ft ?? null) : s.skill_level;
}

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
  is_tournament_only: z.boolean().default(false),
  rating: z.number().int().default(1000),
  public_slug: z.string().nullable().default(null),
  // Validated against the editable lists (skill_levels) when written.
  skill_level: z.string().nullable().default(null),
  skill_level_9ft: z.string().nullable().default(null),
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
  price_manual: z.boolean().default(false),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
export type Session = z.infer<typeof SessionRow>;

export const AttendanceRow = z.object({
  session_id: z.string(),
  student_id: z.string(),
  status: z.enum(["present", "absent", "late", "confirmed", "declined"]),
  marked_by: z.string().min(1),
  marked_at: z.string(),
});
export type Attendance = z.infer<typeof AttendanceRow>;

// "student": a training note, shown to the student too. "team": coach and admin only.
export const NOTE_VISIBILITIES = ["student", "team"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

export const NoteRow = z.object({
  id: z.string(),
  student_id: z.string(),
  session_id: z.string(),
  coach_email: z.email(),
  text: z.string(),
  visibility: z.enum(NOTE_VISIBILITIES).default("student"),
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
