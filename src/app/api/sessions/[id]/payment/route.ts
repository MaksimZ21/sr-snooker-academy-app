import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const Body = z.object({
  payment_status: z.enum(["pending", "paid"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Coaches may only update their own sessions
    if (user.role === "coach") {
      const { data: session } = await db
        .from("sessions")
        .select("coach_email")
        .eq("id", id)
        .single();
      if (!session || session.coach_email !== user.email) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const { payment_status } = Body.parse(await req.json());
    const { error } = await db
      .from("sessions")
      .update({ payment_status })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true, payment_status });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
