import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertStudentFromCrm } from "@/lib/sheets/students";
import {
  fetchTournamentByCrmAppointmentId,
  addTournamentParticipantFromCrm,
  queuePendingRegistration,
} from "@/lib/sheets/tournaments";
import { logWebhook } from "@/lib/sheets/webhook-log";
import { getCrmPaused } from "@/lib/sheets/settings";

const CrmQuery = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().email(),
  college_name: z.string().optional(),
  college_group: z.string().optional(),
  subscription_type: z.string().optional(),
  birthday: z.string().optional(), // DD/MM/YYYY from CRM
});

// A tournament ticket purchase lands on this same "student" webhook, not
// the appointment_approved flow in training/route.ts — identified by
// appointment_id, which the standard student-sync payload above never
// carries. See docs/superpowers/specs/2026-09-18-crm-tournament-events-design.md.
const TournamentTicketQuery = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  appointment_id: z.string().min(1),
});

// Convert DD/MM/YYYY → YYYY-MM-DD for the DB, or null if unparseable
function parseBirthday(raw?: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

async function handleTournamentTicket(raw: Record<string, unknown>) {
  const parsed = TournamentTicketQuery.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "crm", event_type: "tournament_ticket", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { name, phone, appointment_id } = parsed.data;
  const { firstName, lastName } = splitName(name);

  const tournament = await fetchTournamentByCrmAppointmentId(appointment_id);
  if (!tournament) {
    // The tournament event may simply not have arrived yet — park the
    // registration and attach it when the tournament is created, exactly
    // like the equivalent case in training/route.ts's appointment_approved.
    await queuePendingRegistration(appointment_id, { firstName, lastName, phone });
    void logWebhook({ route: "crm", event_type: "tournament_ticket", params: raw, status: "ok", result: { reason: "queued until tournament exists", appointment_id } });
    return NextResponse.json({ ok: true, queued: true, appointment_id });
  }

  const result = await addTournamentParticipantFromCrm(tournament.id, { firstName, lastName, phone });
  void logWebhook({ route: "crm", event_type: "tournament_ticket", params: raw, status: "ok", result: { tournament_id: tournament.id, ...result } });
  return NextResponse.json({ ok: true, tournament_id: tournament.id, ...result });
}

export async function GET(req: Request) {
  if (await getCrmPaused()) {
    return NextResponse.json({ ok: true, paused: true });
  }
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

  if (raw.appointment_id) {
    return handleTournamentTicket(raw);
  }

  const parsed = CrmQuery.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "crm", event_type: "student_upsert", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await upsertStudentFromCrm({
    ...parsed.data,
    birth_date: parseBirthday(parsed.data.birthday),
  });
  void logWebhook({ route: "crm", event_type: "student_upsert", params: raw, status: "ok", result });
  return NextResponse.json(result, { status: 200 });
}
