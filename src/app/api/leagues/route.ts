import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagues, createLeague } from "@/lib/sheets/leagues";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const leagues = await fetchLeagues();
    return NextResponse.json({ leagues });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1),
  manager_email: z.email(),
  num_cycles: z.number().int().positive().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = CreateSchema.parse(await req.json());
    const activeCoachEmails = await fetchActiveCoachEmails();
    if (!activeCoachEmails.map((e) => e.toLowerCase()).includes(body.manager_email.toLowerCase())) {
      return NextResponse.json({ error: "manager_email must be an active coach" }, { status: 400 });
    }
    const league = await createLeague(body);
    return NextResponse.json({ league });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
