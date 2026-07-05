import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchColleges, appendCollege } from "@/lib/sheets/colleges";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchColleges();
    return NextResponse.json({ colleges: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { name } = z.object({ name: z.string().min(1) }).parse(await req.json());
    const id = await appendCollege(name);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
