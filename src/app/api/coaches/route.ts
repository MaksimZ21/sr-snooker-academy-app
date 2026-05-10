import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { appendCoach, deleteCoach } from "@/lib/sheets/coaches-write";

const fetchAll = unstable_cache(
  async () => {
    const { data } = await db.from("coaches").select("*");
    return (data ?? []) as { email: string; name: string; phone: string; active: boolean }[];
  },
  ["coaches:all"],
  { revalidate: 300, tags: ["coaches"] },
);

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ coaches: await fetchAll() });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        email: z.email(),
        name: z.string().min(1),
        phone: z.string().optional(),
      })
      .parse(await req.json());
    const email = await appendCoach(body);
    return NextResponse.json({ email });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return new NextResponse(msg, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { email } = z.object({ email: z.email() }).parse(await req.json());
    await deleteCoach(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
