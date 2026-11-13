import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchTournamentDetail,
  addTournamentParticipant,
  addLocalParticipantsBulk,
  isTournamentManager,
} from "@/lib/sheets/tournaments";

const AddSchema = z
  .object({
    studentId: z.string().min(1).optional(),
    newStudentName: z.string().min(1).optional(),
    localName: z.string().min(1).optional(),
  })
  .refine((v) => v.studentId || v.newStudentName || v.localName, {
    message: "studentId, newStudentName, or localName required",
  });

// A pasted list of names (multi-location tournaments only).
const BulkSchema = z.object({
  localNames: z.array(z.string()).min(1).max(500),
  locationId: z.string().min(1).nullable().optional(),
  houseId: z.string().min(1).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const raw: unknown = await req.json();
    if (raw && typeof raw === "object" && "localNames" in raw) {
      const bulk = BulkSchema.parse(raw);
      const result = await addLocalParticipantsBulk(id, bulk.localNames, bulk.locationId ?? null, bulk.houseId ?? null);
      return NextResponse.json(result);
    }
    const body = AddSchema.parse(raw);
    const participant = await addTournamentParticipant(id, body);
    return NextResponse.json({ participant });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
