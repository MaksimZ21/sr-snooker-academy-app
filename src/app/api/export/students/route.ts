import { NextResponse } from "next/server";
import { fetchStudents } from "@/lib/sheets/students";

export async function GET(req: Request) {
  const apiKey = process.env.EXPORT_API_KEY;
  if (!apiKey) return new NextResponse("not configured", { status: 503 });

  const incoming =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (incoming !== apiKey) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const students = await fetchStudents();
  return NextResponse.json({ students });
}
